#!/bin/bash

# Build the image
docker build -t meinya/ai-translator:latest .

# Push to Docker Hub
docker push meinya/ai-translator:latest
