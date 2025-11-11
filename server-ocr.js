const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const fetch = require("node-fetch");
const { saveOCRResults: persistOCRResults } = require("./image-manipulator/backend/services/result-saver");
const { checkResultFiles } = require("./image-manipulator/backend/services/skip-detector");

class OCRService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = "https://openrouter.ai/api/v1";
    this.model = "openai/gpt-4o-mini";
  }

  /**
   * Check if an image has already been OCR'd
   */
  async hasOCRResults(imagePath) {
    try {
      const files = await checkResultFiles(imagePath);
      return Boolean(files.json || files.txt);
    } catch {
      return false;
    }
  }

  /**
   * Load existing OCR results
   */
  async loadOCRResults(imagePath) {
    try {
      const files = await checkResultFiles(imagePath);
      if (!files.json) {
        return null;
      }
      const data = await fs.readFile(files.json, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Compress and prepare image for API
   */
  async prepareImage(imagePath) {
    try {
      // Read and compress image
      const imageBuffer = await sharp(imagePath)
        .jpeg({ quality: 85 })
        .resize(1600, 1600, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toBuffer();

      // Convert to base64
      const base64 = imageBuffer.toString("base64");
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error("Error preparing image:", error);
      throw error;
    }
  }

  /**
   * Detect if image is a driver license or selfie
   */
  async detectImageType(base64Image) {
    const prompt = `Analyze this image and determine what type it is.

Respond with a single word:
- "license_front" if it shows the front of a driver's license (with photo, name, address)
- "license_back" if it shows the back of a driver's license (with barcode, restrictions)
- "selfie" if it shows a person's face/selfie
- "unknown" if you cannot determine

Only respond with one of these words.`;

    try {
      const data = await this._fetchWithRetry(
        () => ({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: base64Image } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 50,
        }),
        "detectImageType"
      );
      const type =
        data.choices?.[0]?.message?.content?.trim().toLowerCase() || "unknown";
      return type;
    } catch (error) {
      console.error("Error detecting image type:", error);
      return "unknown";
    }
  }

  /**
   * Extract driver license information
   */
  async extractDriverLicense(base64Image) {
    const prompt = `Extract information from this driver's license image. Return a JSON object with these fields:

{
  "firstName": "extracted first name",
  "lastName": "extracted last name",
  "middleName": "middle name if present",
  "licenseNumber": "license number",
  "dateOfBirth": "MM/DD/YYYY format",
  "expirationDate": "MM/DD/YYYY format",
  "address": "full address",
  "city": "city",
  "state": "state abbreviation",
  "zipCode": "zip code",
  "sex": "M or F",
  "height": "height",
  "weight": "weight",
  "eyeColor": "eye color",
  "restrictions": "restrictions if any",
  "class": "license class"
}

If a field is not visible or cannot be extracted, set it to null.
Return ONLY the JSON object, no other text.`;

    try {
      const data = await this._fetchWithRetry(
        () => ({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: base64Image } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
        "extractDriverLicense"
      );

      const content = data.choices?.[0]?.message?.content || "{}";
      try {
        return JSON.parse(content);
      } catch {
        return { error: "Failed to parse OCR results" };
      }
    } catch (error) {
      console.error("Error extracting license info:", error);
      throw error;
    }
  }

  /**
   * Process a single image
   */
  async processImage(imagePath) {
    try {
      // Check if already processed
      if (await this.hasOCRResults(imagePath)) {
        console.log(`Skipping ${path.basename(imagePath)} - already processed`);
        return {
          status: "skipped",
          path: imagePath,
          message: "Already has OCR results",
        };
      }

      // Prepare image
      const base64Image = await this.prepareImage(imagePath);

      // Detect image type
      const imageType = await this.detectImageType(base64Image);

      // Only process driver licenses
      if (!imageType.includes("license")) {
        console.log(
          `Skipping ${path.basename(imagePath)} - not a license (${imageType})`
        );
        return {
          status: "skipped",
          path: imagePath,
          message: `Not a driver license (detected: ${imageType})`,
        };
      }

      // Extract license information
      const ocrData = await this.extractDriverLicense(base64Image);

      // Add metadata
      const result = {
        ...ocrData,
        imageType,
        processedAt: new Date().toISOString(),
        model: this.model,
        imagePath: imagePath,
      };

      // Save results
      await this.saveOCRResults(imagePath, result);

      return {
        status: "success",
        path: imagePath,
        data: result,
      };
    } catch (error) {
      console.error(`Error processing ${imagePath}:`, error);
      return {
        status: "error",
        path: imagePath,
        error: error.message,
      };
    }
  }

  /**
   * Save OCR results to JSON and TXT files
   */
  async saveOCRResults(imagePath, ocrData) {
    const imageDir = process.env.IMAGE_DIR || path.dirname(imagePath);
    await persistOCRResults(imagePath, ocrData, {
      outputFormat: ["json", "txt"],
      overwrite: "overwrite",
      imageDir
    });
    console.log(`Saved OCR results for ${path.basename(imagePath)}`);
  }

  /**
   * Format OCR data as human-readable text
   */
  formatAsText(data) {
    let text = "DRIVER LICENSE OCR RESULTS\n";
    text += "=".repeat(30) + "\n\n";

    text += `Processed: ${data.processedAt}\n`;
    text += `Image Type: ${data.imageType}\n`;
    text += `Model: ${data.model}\n\n`;

    text += "EXTRACTED INFORMATION:\n";
    text += "-".repeat(20) + "\n";

    if (data.firstName) text += `First Name: ${data.firstName}\n`;
    if (data.lastName) text += `Last Name: ${data.lastName}\n`;
    if (data.middleName) text += `Middle Name: ${data.middleName}\n`;
    if (data.licenseNumber) text += `License Number: ${data.licenseNumber}\n`;
    if (data.dateOfBirth) text += `Date of Birth: ${data.dateOfBirth}\n`;
    if (data.expirationDate)
      text += `Expiration Date: ${data.expirationDate}\n`;
    text += "\n";

    if (data.address) text += `Address: ${data.address}\n`;
    if (data.city) text += `City: ${data.city}\n`;
    if (data.state) text += `State: ${data.state}\n`;
    if (data.zipCode) text += `Zip Code: ${data.zipCode}\n`;
    text += "\n";

    if (data.sex) text += `Sex: ${data.sex}\n`;
    if (data.height) text += `Height: ${data.height}\n`;
    if (data.weight) text += `Weight: ${data.weight}\n`;
    if (data.eyeColor) text += `Eye Color: ${data.eyeColor}\n`;
    text += "\n";

    if (data.class) text += `Class: ${data.class}\n`;
    if (data.restrictions) text += `Restrictions: ${data.restrictions}\n`;

    return text;
  }

  /**
   * Estimate processing cost
   */
  estimateCost(imageCount) {
    // Approximate cost per image for GPT-4o-mini
    const costPerImage = 0.00026;
    return {
      totalCost: (imageCount * costPerImage).toFixed(4),
      perImage: costPerImage,
      currency: "USD",
    };
  }

  /**
   * Internal helper with retry & exponential backoff for transient failures
   */
  async _fetchWithRetry(payloadBuilder, label = "request") {
    const maxAttempts = 4;
    let attempt = 0;
    let lastError;
    const baseDelay = 500; // ms

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const appOrigin =
          process.env.PUBLIC_ORIGIN ||
          process.env.APP_ORIGIN ||
          `http://localhost:${process.env.PORT || 3001}`;
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": appOrigin,
            Origin: appOrigin,
            "X-Title": "Image Manipulator OCR",
          },
          body: JSON.stringify(payloadBuilder()),
        });

        if (!response.ok) {
          const status = response.status;
          // Non-retryable codes
          if ([400, 401, 403, 404].includes(status)) {
            const text = await response.text();
            throw new Error(`Non-retryable API error ${status}: ${text}`);
          }
          // Retryable codes (429 rate limit, 5xx server)
          if (attempt < maxAttempts && (status === 429 || status >= 500)) {
            const retryAfter = parseInt(
              response.headers.get("retry-after") || "0",
              10
            );
            const delay =
              retryAfter > 0
                ? retryAfter * 1000
                : baseDelay * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          const text = await response.text();
          throw new Error(`API error ${status}: ${text}`);
        }

        return await response.json();
      } catch (err) {
        lastError = err;
        // Network errors or aborted requests -> retry if attempts remain
        const message = err.message || "";
        const retryableNetwork =
          /fetch|network|timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message);
        if (attempt < maxAttempts && retryableNetwork) {
          const delay =
            baseDelay * Math.pow(2, attempt - 1) + Math.random() * 150;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }
    throw lastError || new Error(`Unknown ${label} failure`);
  }

  /**
   * Health check for API key validation
   */
  async healthCheck() {
    if (!this.apiKey) {
      return { ok: false, error: "API key missing" };
    }
    try {
      const data = await this._fetchWithRetry(
        () => ({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: "Return the word OK." }],
            },
          ],
          temperature: 0,
          max_tokens: 5,
        }),
        "healthCheck"
      );
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      return { ok: /^ok$/i.test(text), model: this.model, raw: text };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = OCRService;
