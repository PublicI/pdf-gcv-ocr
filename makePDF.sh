if [[ -d "$1" ]]
then
    ./lib/hocr-pdf.py $1
else
    echo "Provided argument is not a directory"
fi