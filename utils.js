const {promisify} = require('util');
const fs = require('fs');

module.exports = {
    readdirAsync: promisify(fs.readdir),
    writeFileAsync: promisify(fs.writeFile),
    readFileAsync: promisify(fs.readFile),
    hasToBeArray: function(obj) {
        // Function will check if item is an array, if not will return an array with input
        return Array.isArray(obj) ? obj : new Array(obj)
    }
}