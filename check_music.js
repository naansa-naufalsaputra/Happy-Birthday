const fs = require('fs');
const path = 'd:/Coding/HBD/combined-birthday/assets/images/music.mp3';
if (fs.existsSync(path)) {
    console.log('File size:', fs.statSync(path).size);
} else {
    console.log('File not found');
}
