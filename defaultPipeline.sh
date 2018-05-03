echo "Checking to make sure $1 is a PDF"
if [ $(head -c 4 "$1") = "%PDF" ]; then 
    npm run ocr $1
    npm run hocr $1_ocr
    npm run pdf $1_ocr
else
    echo "$1 is not a valid PDF file."
fi