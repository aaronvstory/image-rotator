FROM ubuntu:latest

# Install required dependencies
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 libgl1

# Add your application files (if any)
COPY . /app

# Set the working directory
WORKDIR /app

# Set the default command to run the server
CMD ["imagesorcery"]
