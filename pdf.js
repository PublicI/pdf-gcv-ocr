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
const HummusRecipe = require('hummus-recipe');

// Simple pass-through to pdftohtml so we can keep track of where the images went...
function convertPDF(inputFile, outputDir) {
    console.log(`Writing all images in ${inputFile} to ${outputDir}`);

    return new Promise((resolve, reject) => {
        const inputPath = path.parse(inputFile);
        const outputFile = path.join(inputPath.dir, outputDir, inputPath.name);
        console.warn('Only looking at first 10 pages for demo, CHANGE THIS BEFORE PRODUCTION.');
        exec(`mkdir -p "${path.dirname(outputFile)}" && pdftohtml -zoom 4 -c -l 10 -xml "${inputFile}" "${outputFile}"`, async (error, stdout, stderr) => {
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

function translateCoords(coords, page, pdfPage) {
    // the pdftohtml output is from top to bottom, we want bottom to top
    // also need to rescale the pdftohtml output from the page values and convert it to the new dimensions;
    let top = coords.top;
    let left = coords.left;

    let newCoords = {
        top: (top/page.height) * pdfPage.height,
        left: (left/page.width) * pdfPage.width,
        height: (coords.height/page.height) * pdfPage.height,
        width: (coords.width/page.width) * pdfPage.width
    }
    
    return newCoords;
}

function setFonts(doc, page, pageMetadata) {
    let scale = pageMetadata.width/page.width;
    scale = 0.8;
    
    console.log(pageMetadata.height, page.height, page.fontspec);

    utils.hasToBeArray(page.fontspec)
    .forEach(font => {
        font.size = font.size * scale;
        doc.fontSpec.set(font.id, font)
    });

    return doc
}

function parseGCV(doc, page) {
    // Script that will parse the GCV output and create a text format similar to page.text so that we can add it to the pdf.
    let pageMetadata = doc.pageInfo(page.number);

    return _(page.image)
    .map(image => image.ocr)
    .flatMap(image => _(utils.readFileAsync(image, 'utf-8')))
    .map(JSON.parse)
    .pluck('fullTextAnnotation')
    .flatten()
    .pluck('pages')
    .flatten()
    .doto(pg => {
        page.height = pg.height;
        page.width = pg.width;
    })
    .pluck('blocks')
    .flatten()
    .pluck('paragraphs')
    .flatten()
    .pluck('words')
    .flatten()
    .pluck('symbols')
    .flatten()
    .map(d => {
        let height = Math.max(...d.boundingBox.vertices.map(d => d.y)) - Math.min(...d.boundingBox.vertices.map(d => d.y));
        let width = Math.max(...d.boundingBox.vertices.map(d => d.x)) - Math.min(...d.boundingBox.vertices.map(d => d.x));
        
        console.log(JSON.stringify(d.boundingBox), d.text);

        let coords = { top: Math.max(...d.boundingBox.vertices.map(d => d.y)), left: Math.max(...d.boundingBox.vertices.map(d => d.x)), height: height, width: width };
        let newCoords = coords//translateCoords(coords, page, pageMetadata);
        //newCoords.boundingBox =  boundingBox: JSON.stringify(d.boundingBox)
        newCoords['@text'] = d.text
        return newCoords
    })
    .collect()
    .toPromise(Promise)
    .then(texts => {
        page.text = texts
        return page
    });
    //.zip(imageStream)
    //.each(console.log)
    
}

function enrichPage(doc, page, fonts) {
    page.number = parseInt(page.number);

    let pageMetadata = doc.pageInfo(page.number);
    let pdfPage = doc.editPage(page.number)

    if(page.fontspec) doc = setFonts(doc, page, pageMetadata);

    _(utils.hasToBeArray(page.text))
    .map(text => {
        let textCoords = translateCoords(text, page, pageMetadata);
        let font;
        if(typeof text.font == 'object') font = doc.fontSpec.get(text.font);
        else font = {
            family: "Times",
            color: "#000000",
            size: 3
        }

        font.textBox = {
            width: text.width,
            height: text.height,
            lineHeight: text.height,
            lineWidth: text.width
        }

        pdfPage.text(text['@text'], textCoords.left, textCoords.top, font)
    })
    .done(() => {
        pdfPage.endPage();
    })
    
    return doc;
}

function initializePDF(inputFile) {
    const inputPDF = new HummusRecipe(inputFile, 'output.pdf');
    inputPDF.fontSpec = new Map();

    //console.log(`${inputPDF.getModifiedFileParser().getPagesCount()} pages found.`);

    return inputPDF;
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
    readPDF: readPDF,
    parseGCV: parseGCV
}