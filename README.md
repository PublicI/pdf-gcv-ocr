# GCV to PDF OCR Tool

This tool will take an arbitrary PDF file and run it through Google Cloud Vision and generate hOCR and PDF output for the same.

This uses the DOCUMENT_TEXT_DETECTION operation on Cloud Vision, but could easily be adopted to just use TEXT_DETECTION. 

To convert the GCV JSON output to hOCR - a modified version of the [gcv2hocr](https://github.com/dinosauria123/gcv2hocr) package is used (which only works with TEXT_DETECTION). To convert this hOCR output to a searchable PDF, the `hocr-pdf` script from [hocr-tools](https://github.com/tmbdev/hocr-tools) package is used. This script is included at `./lib/hocr-pdf.py`.

## How it works

To convert a PDF using the default options just run `npm run all <pdfFile>` which will output the searchable PDF file to `STDOUT`. It also creates a folder called `<pdfFile>_ocr` which contains the extracted images, the XML representation of the original PDF and the hOCR output for each page.

N.B. The node.js scripts contain some code that is not currently being used but provides for future functionality (including making mixed-content searchable PDFs)

## GCV Credentials 

Create an IAM user in Google Cloud Console with a "Service Account User" Role and give that account permissions to use the Cloud Vision API. Save the credentials from the console to `credentials.json` in the root of this project.