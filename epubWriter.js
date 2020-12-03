const axios = require('axios');
const epub = require('epub-gen');

const fs = require('fs');


axios.get('http://www.gutenberg.org/files/2701/2701-0.txt').
    then(res => res.data).
    then(text => {
        fs.writeFile('./data/moby-dick.txt', text, function (err, result) {
            if (err) console.log('error', err);
        });

        text = text.slice(text.indexOf('EXTRACTS.'));
        text = text.slice(text.indexOf('CHAPTER 1.'));

        const lines = text.split('\r\n');
        const content = [];
        for (let i = 0; i < lines.length; ++i) {
            const line = lines[i];
            if (line.startsWith('CHAPTER ')) {
                if (content.length) {
                    content[content.length - 1].data = content[content.length - 1].data.join('\n');
                }
                content.push({
                    title: line,
                    data: ['<h2>' + line + '</h2>']
                });
            } else if (line.trim() === '') {
                if (content[content.length - 1].data.length > 1) {
                    content[content.length - 1].data.push('</p>');
                }
                content[content.length - 1].data.push('<p>');
            } else {
                content[content.length - 1].data.push(line);
            }
        }

        const options = {
            title: 'Moby-Dick',
            author: 'Herman Melville',
            output: './data/moby-dick.epub',
            content
        };

        let json = JSON.stringify(options);
        fs.writeFile('./data/moby-dick.json', json, function (err, result) {
            if (err) console.log('error', err);
        });

        return new epub(options).promise;
    }).
    then(() => console.log('Done'));



/*
const writeEpub = async function (data, pathName) {
        const option = {
            title: "Alice's Adventures in Wonderland", // *Required, title of the book.
            author: "Lewis Carroll", // *Required, name of the author.
            publisher: "Macmillan & Co.", // optional
            cover: "http://demo.com/url-to-cover-image.jpg", // Url or File path, both ok.
            content: [
                {
                    title: "About the author", // Optional
                    author: "John Doe", // Optional
                    data: "<h2>Charles Lutwidge Dodgson</h2>"
                        + "<div lang=\"en\">Better known by the pen name Lewis Carroll...</div>" // pass html string
                },
                {
                    title: "Down the Rabbit Hole",
                    data: "<p>Alice was beginning to get very tired...</p>"
                },
                {
                    ...
                }
                ...
            ]
        };

    new Epub(option, pathName);

}
*/




