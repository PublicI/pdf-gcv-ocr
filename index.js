const fs = require('fs');
const path = require('path');
const _ = require('highland');
const fastXmlParser = require('fast-xml-parser');
const inputFile = "./test/CPB-FOIA-Release-CBP000421.pdf";
const outputDir = "CBP_Claims_Images";
const outputPath = path.join(path.dirname(inputFile), outputDir);
const resultsPath = './CBP_FOIA_Response_OCR.json';

const pdf = require('./pdf');
const gcv = require('./gcv');
const utils = require('./utils');

function ocrPDF() {
    let metadata = {};

    let pdfStream = _(pdf.convertPDF(inputFile, outputDir))
    .doto(output => {
        metadata = output;
        fs.writeFileSync(path.join(metadata.outputDir, "metadata.json"), JSON.stringify(metadata));
    })
    .pluck('pdfImages')
    .flatten()
    
    let gcvStream = pdfStream.fork();

    let imageStream = pdfStream.observe()
    .map(fileName => fileName.replace(path.extname(fileName), '.json'));

    gcvStream
    .through(gcv.prepareGCV)
    .batch(5)
    .flatMap(d => _(gcv.performGCV(d)))
    .flatten()
    .pluck('responses')
    .flatten()
    .map(d => JSON.stringify(d))
    .zip(imageStream)
    .flatMap(result => _(writeFile(result)))
    .each(fileName => {
        console.log(`${fileName}`);
    })
}

function recreatePDF() {
    let pdfPath = path.parse(inputFile);
    let pdfXML = path.join(pdfPath.dir, outputDir, pdfPath.base.replace(pdfPath.ext, '.xml'));
    let inputPDF = pdf.initializePDF(inputFile);

    _(utils.readFileAsync(pdfXML, 'utf-8'))
    .map(xml => fastXmlParser.parse(xml, {ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true, textNodeName: '@text'}))
    .pluck('pdf2xml')
    .pluck('page')
    .map(utils.hasToBeArray)
    .flatten()
    .filter(page => page.hasOwnProperty('image'))
    .reduce(inputPDF, pdf.enrichPage) // convert the pdf xml into a page.
    .done(f => inputPDF.end())
}

async function writeFile(result) {
    let ocrOutput = result[0];
    let outputFile = result[1];

    await utils.writeFileAsync(outputFile, ocrOutput);
    
    return outputFile;
}

recreatePDF()