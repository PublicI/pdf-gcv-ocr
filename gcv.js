// Functions related to working with Google Cloud Vision
const vision = require('@google-cloud/vision');
const fs = require('fs');

// Hit GCV with an image to OCR and return the results
function performGCV(requests) {
    // GCV Client
    const client = new vision.ImageAnnotatorClient({
        keyFilename: './credentials.json'
    });
    // Performs label detection on the image file
    return client
    .batchAnnotateImages({requests: requests})
    .then(results => {
        return results
    })
}

// Take an image path and output the data in a GCV compatible stream
function prepareGCV(images) {
    return images.map(image => {
        return {
            fileName: image,
            image: {
                content: fs.readFileSync(image)
            }
        }
    })
    .map(d => {
        return {
            image: d.image,
            features: [{
                type: "DOCUMENT_TEXT_DETECTION",
                model: 'builtin/latest'
            }]
        }
    })
}

module.exports = {
    performGCV: performGCV,
    prepareGCV: prepareGCV
}