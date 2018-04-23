global.window = {document: {createElementNS: () => {return {}} }};
global.navigator = {};
global.btoa = () => {};

const jsPDF = require('jspdf');
const path = require('path');
const utils = require('./utils');
const exec = require('child_process').exec;
const fs = require('fs');
const hummus = require('hummus');
const _ = require('highland');

// Simple pass-through to pdftohtml so we can keep track of where the images went...
function convertPDF(inputFile, outputDir) {
    console.log(`Writing all images in ${inputFile} to ${outputDir}`);

    return new Promise((resolve, reject) => {
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, outputDir, inputPath.name);
        console.warn('Only looking at first 10 pages for demo, CHANGE THIS BEFORE PRODUCTION.');
        exec(`mkdir -p "${path.dirname(outputFile)}" && pdftohtml -c -l 10 -xml "${inputFile}" "${outputFile}"`, async (error, stdout, stderr) => {
            if (error || stderr) reject([error, stderr]);
            else {
                outputDir = path.dirname(outputFile);
                
                let extractedFiles = await utils.readdirAsync(outputDir);

                extractedFiles = extractedFiles.map(file => path.join(outputDir, file));
                
                let pdfMetadata = extractedFiles.filter(file => path.extname(file) == '.xml')[0];
                let pdfImages = extractedFiles.filter(file => path.extname(file) == '.png');

                resolve({
                    outputDir: outputDir,
                    pdfMetadata: pdfMetadata,
                    pdfImages: pdfImages
                });
            }
        });
    })
}

function readPDF(inputFile){
    let pdfReader = hummus.createReader(inputFile);
    return pdfReader;
}

function makePage(doc, page) {
    // Landscape letter paper
    let defaultDPI = 75; //PDFTOHTML default;

    //let pageOrientation = page.height > page.width ? 'portrait' : 'landscape';
    let pageHeight = page.height/75;
    let pageWidth = page.width/75;

    doc = doc ? doc.addPage([pageWidth, pageHeight]) : initializePDF(pageHeight, pageWidth)

    let fonts = utils.hasToBeArray(page.fontspec);
    let images = utils.hasToBeArray(page.image);
    let texts = utils.hasToBeArray(page.text);

    return doc;
}

function translateCoords(coords, page, pdfPage) {
    // the pdftohtml output is from top to bottom, we want bottom to top
    // also need to rescale the pdftohtml output from the page values and convert it to the new dimensions;
    let top = coords.top;
    let left = coords.left;
    let newCoords = {
        top: (top/page.height) * pdfPage[2],
        left: (left/page.width) * pdfPage[3]
    }

    console.log(newCoords);

    return newCoords
}

function enrichPage(doc, page) {
    page.number = parseInt(page.number);

    if(page.number > doc.getModifiedFileParser().getPagesCount()) return doc;

    let parsedPage = doc.getModifiedFileParser().parsePage(page.number - 1);    
    let pageModifier = new hummus.PDFPageModifier(doc, page.number-1);

    let textOptions = {font:doc.getFontForFile('./Courier.dfont'), size: 10, colorspace:'gray',color:0x00};
    
    let ctx = pageModifier.startContext().getContext();

    //ctx.cm(0, 1, -1, 0, 0, 0)
    let ratio = parsedPage.getMediaBox()[1]/page.height;

    ctx.cm(...[0,1,-1,0,0,-parsedPage.getMediaBox()[2]])
    _(utils.hasToBeArray(page.text))
    .each(text => {
        console.log(text);
        let textCoords = translateCoords(text, page, parsedPage.getMediaBox());
        ctx.writeText(
            text['@text'],
            textCoords.top,
            textCoords.left,
            textOptions
        )
    })
    
    pageModifier.endContext().writePage();
    return doc;
}

function initializePDF(inputFile) {
    let inputPDF = hummus.createWriterToModify(inputFile,{
        modifiedFilePath:  './modified.pdf'
    });

    console.log(`${inputPDF.getModifiedFileParser().getPagesCount()} pages found.`);

    return inputPDF;
    /* let pageOrientation = pageWidth > pageHeight ? 'landscape' : 'portrait';

    var doc = new jsPDF({
        unit: 'in',
        orientation: pageOrientation,
        format: [pageWidth, pageHeight]
    });

    return doc; */
}

function writePDF(doc) {
    // Takes the GCV output and adds a text layer into the PDF.
    fs.writeFileSync('document.pdf', doc.output());

    delete global.window;
    delete global.navigator;
    delete global.btoa;  
}

module.exports = {
    convertPDF: convertPDF,
    initializePDF: initializePDF,
    enrichPage: enrichPage,
    writePdf: writePDF,
    readPDF: readPDF
}