const puppeteer = require('puppeteer');
const fs = require('fs');
const creds = require('./creds.js');

/**************************************

ISSUES : 

page bebing scraped needs to be in focus for buttons to be clicked

chapter 0 not being written to disk, faile with eror message :
    Writing File :  ./data/Welcome.mhtml
    Error: Protocol error (Page.captureSnapshot): Failed to generate MHTML
        ...
        at savePage (/home/lk/workspace/scraper/scrapers_1.js:302:40)

Chapter 0 contain embedded PDF, could it cause the error in saving mhtml file ?

The script makes certain assumptions about DOM, therefore, needs puppeteer to run on wide viewport, at least 1200px.

**************************************/

async function run() {

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null // you may also specify a specific viewport size.
    });

    //open page with login url
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.on('load', req => (console.log('Page loaded:' + page.url())));

    const URL_LOGIN_PAGE = 'https://courses.edx.org/login';
    await page.goto(URL_LOGIN_PAGE);

    const SELECTOR_USERNAME = '#login-email';
    const SELECTOR_PASSWORD = '#login-password';
    const SELECTOR_SUBMIT = '#login > button';
    await page.click(SELECTOR_USERNAME);
    await page.keyboard.type(creds.username);
    await page.click(SELECTOR_PASSWORD);
    await page.keyboard.type(creds.password);
    await page.click(SELECTOR_SUBMIT);
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    //const SELECTOR_START_BUTTON = '#block-v1\\:LinuxFoundationX\\+LFS158x\\+2T2019\\+type\\@chapter\\+block\\@48d68448eff24f02bcb78470dec9c6a1'; // chapter 1
    //const SELECTOR_START_LINK = '#block-v1\\:LinuxFoundationX\\+LFS158x\\+2T2019\\+type\\@sequential\\+block\\@13caf57cc8d448a88e26e36fec502fb0'; // first link under chapter 1 

    const SELECTOR_CHAPTER_BUTTON = 'ol#course-outline-block-tree li.section:nth-of-type(<<i>>) > button';
    const SELECTOR_FIRST_SECTION_LINK = 'ol#course-outline-block-tree li.section:nth-of-type(<<i>>) ol.accordion-panel li a';
    const SELECTOR_ALL_CHAPTER_BUTTONS = 'ol#course-outline-block-tree li.section > button';
    const PROPERTY_START_BUTTON_EXPANDED = 'aria-expanded'

    const URL_CONTENTS_PAGE = 'https://courses.edx.org/courses/course-v1:LinuxFoundationX+LFS158x+2T2019/course/';
    await page.goto(URL_CONTENTS_PAGE, { waitUntil: 'networkidle0' });

    const chaptersCount = await page.evaluate((sel) => document.querySelectorAll(sel).length,
        SELECTOR_ALL_CHAPTER_BUTTONS);

    console.log(`Chapters count: ${chaptersCount}`);

    for (chapterNum = 0; chapterNum < chaptersCount; chapterNum++) {
    //for (chapterNum = 2; chapterNum < 3; chapterNum++) {

        // make sure you are on contents page

        // click on ith chapter           
        try {
            await page.waitForSelector(SELECTOR_CHAPTER_BUTTON.replace('<<i>>', chapterNum + 1));
            const isExpanded = await page.evaluate((sel, prop) => document.querySelector(sel).getAttribute(prop), SELECTOR_CHAPTER_BUTTON.replace('<<i>>', chapterNum + 1), PROPERTY_START_BUTTON_EXPANDED);
            console.log("isExpanded : ", isExpanded);
            if (isExpanded == 'false') // 'false' is not falsey, '' is falsey
                await page.click(SELECTOR_CHAPTER_BUTTON.replace('<<i>>', chapterNum + 1));
            // page.waitForSelector('#myId', {visible: true})
            await page.waitForSelector(SELECTOR_FIRST_SECTION_LINK.replace('<<i>>', chapterNum + 1));
            await page.waitForTimeout(2000); // is this needed ?

            // # sections
            console.log(`sections in this chapter: ${await page.evaluate( (i) => document.querySelectorAll('ol#course-outline-block-tree li.section:nth-of-type(' + i + ') ol.accordion-panel li').length,
                                                                          chapterNum + 1)
                }`)

            // instead wait for it to become visible
            // how to check if an element is visible on the page
            // window.getComputedStyle(document.querySelector(sel),null).getPropertyValue('display') // is not working
            await page.click(SELECTOR_FIRST_SECTION_LINK.replace('<<i>>', chapterNum + 1));
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            console.log(`Going to first section of chapter ${chapterNum} ...`);
        } catch (error) {
            console.log("Oops ...", error);
        }

        const SELECTOR_TAB_BUTTON = ".sequence-navigation-tabs button:nth-of-type(<<i>>)";
        const SELECTOR_NEXT_BUTTON = 'div.sequence nav button.next-btn'; //"div.sequence-nav button.button-next";
        const SELECTOR_ALL_TABS = ".sequence-navigation-tabs button"
        const SELECTOR_CONTENT = '#main > div.xblock.xblock-student_view.xblock-student_view-vertical.xblock-initialized';
        const SELECTOR_BREADCRUMS = 'nav[aria-label="breadcrumb"] ol'; //".breadcrumbs";
        const SELECTOR_ICON_IN_BREADCRUMBS = 'li[role="presentation"]'; //"span.icon";
        const SELECTOR_HEADING = 'div.unit > h2'; //"#seq_content h2";
        const SELECTOR_REVIEW_IMAGE = 'img[src*="LearningObjectives.png"]';

        // create blank aggrigator page
        console.log(page.url());
        const agPage = await browser.newPage(); // aggrigator page

        const AG_URL = 'https://courses.edx.org/xblock/block-v1:LinuxFoundationX+LFS158x+2T2019+type@vertical+block@453babddfd324944b4f6623bd18f3536?show_title=0&show_bookmark_button=0'
        await agPage.goto(AG_URL, { waitUntil: 'networkidle0' });

        //await agPage.goto(page.url(), { waitUntil: 'networkidle0'} );
        await agPage.evaluate(() => {
            document.querySelector('body').innerHTML = "";

            var css = `div.header ol li::marker {
                            content: '';
                        }
                        
                        div.header ol {
                            padding: 2px;
                            color: #666;
                        }
                        
                        div.header > h2 {
                            color: #444;
                            font-size: 1.5em;
                            padding-bottom: 4px;
                        }
                        body{
                            padding: 4px;
                        }`,
            head = document.head,
            style = document.createElement('style');
            head.appendChild(style);
            style.type = 'text/css';
            style.appendChild(document.createTextNode(css));
        })


        let bcItems = [];

        //const MAX_TAB_ITER = 25; 
        const MAX_SEC_ITER = 6;
        let tabIter = 0; // tab scrape iteration
        let secIter = 0; // section scrape iteration

        while (secIter < MAX_SEC_ITER) {
            console.log(`Section(${++secIter}) begin ...`);

            await page.waitForSelector(SELECTOR_ALL_TABS);
            const tabCount = await page.evaluate((sel) =>
                document.querySelectorAll(sel).length
                , SELECTOR_ALL_TABS);
            console.log("Total tabs in this section: " + tabCount);

            for (i = 1; i <= tabCount; i++) {
                console.log(`Tab ${++tabIter} begin ...`);
                // await page.waitForSelector(SELECTOR_TAB_BUTTON.replace("<<i>>", i));
                await page.click(SELECTOR_TAB_BUTTON.replace("<<i>>", i));

                await page.waitForTimeout(1000);
                //await page.waitUntil({ waitUntil: 'networkidle0'}); // is there a better way to check if iframe has finished loading
                // how to check the content has changed

                const frameHandle = await page.waitForSelector('iframe#unit-iframe');
                const frame = await frameHandle.contentFrame();

                const { headerHtml, breadcrumItems } = await page.evaluate(headerExtractor,
                    {
                        selectors: {
                            SELECTOR_BREADCRUMS: SELECTOR_BREADCRUMS,
                            //SELECTOR_BOOKMARK: SELECTOR_BOOKMARK,
                            SELECTOR_ICON_IN_BREADCRUMBS: SELECTOR_ICON_IN_BREADCRUMBS,
                            //SELECTOR_PAYWALL: SELECTOR_PAYWALL,
                            SELECTOR_HEADING: SELECTOR_HEADING,
                            //SELECTOR_REVIEW_IMAGE: SELECTOR_REVIEW_IMAGE
                        },
                        tabInfo: [i, tabCount]
                    });

                await page.waitForTimeout(2000);

                const contentHtml = await frame.evaluate((sel) => {
                    (document.querySelectorAll('img[src*="LearningObjectives.png"]')).forEach((el) => el.remove()); // use defined constant SELECTOR_REVIEW_IMAGE
                    (document.querySelectorAll('form.annotator-widget')).forEach((el) => el.remove()); // Define constant
                    return document.querySelector(sel).outerHTML;
                }, SELECTOR_CONTENT);
                bcItems = breadcrumItems;

                const tabHtml = '<div class="tab-data" style="margin-bottom:40px">' + headerHtml + contentHtml + '</div><div class="seprator seprator-tab"></div>'
                await agPage.evaluate((htmlStr) => {
                    document.querySelector("body").innerHTML += htmlStr;
                }, tabHtml);
            }

            //if next button is inactive break
            const hasNext = await page.evaluate((sel) => {
                !document.querySelector(sel).disabled
            }, SELECTOR_NEXT_BUTTON);
            if (hasNext == false)
                break;

            //click next 
            await page.click(SELECTOR_NEXT_BUTTON);
            console.log("Next Button Clicked ...")
            await page.waitForTimeout(3000); // look for better way to wait

            /*
            // failed with: UnhandledPromiseRejectionWarning: TimeoutError: Navigation timeout of 60000 ms exceeded
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
            });
            */

            // check if chapter changed, for now break if it did
            const tempBcItems = await page.evaluate((sel) => {
                return [...document.querySelector(sel).children].map(e => e.innerText).filter(e => e.trim().length)
            }, SELECTOR_BREADCRUMS);

            let diffBc = await diffIndex(bcItems, tempBcItems);

            console.log("OLD BreadCrums: ", bcItems.toString());
            console.log("NEW BreadCrums: ", tempBcItems.toString());
            // why am I getting same bc, is it because I am not waiting for net0
            console.log("diffBc: ", diffBc);

            if (diffBc.index == -1) {
                console.log("How come new & prev bc are same ?");
            }
            if (diffBc.index >= 0 && diffBc.index <= 2) {
                console.log("Chapter Ended");
                break;
            }

            // if previous chapter is set && previous is different from new
            // insert chapter delimeter
        }

        //debug : log when content element is not found

        // breaking condition : 
        // when next is disabled : 
        // it has class disabled & and also a property disables is set like following 
        // <button class="sequence-nav-button button-next disabled" disabled="disabled">    

        // ? remove all unwanted tags like script from agPage
        //save tab 2 with all assets locally
        const PATH_DATA_DIR = "./data";
        // ckeck if dir exists, if not create one

        await savePage(agPage, PATH_DATA_DIR + "/" + bcItems[2].replace(/[^\w\s-]/gi, '').replace(/ /g, '_') + ".mhtml", 'mhtml');
        //await savePage(agPage, PATH_DATA_DIR + "/" + 'temp' + ".mhtml", 'mhtml');

        const URL_CONTENTS_PAGE = 'https://courses.edx.org/courses/course-v1:LinuxFoundationX+LFS158x+2T2019/course/';
        await page.goto(URL_CONTENTS_PAGE, { waitUntil: 'networkidle0' });

        console.log(`waiting 1 mins before closing the aggregator tab`);
        await agPage.waitForTimeout(60000);
        agPage.close();

    }

}



run();



// Extracts and formats header 
const headerExtractor = async function (context) {
    // accepts { selectors: {sel: val, ...}, tabInfo: [n, m] }
    const { SELECTOR_BREADCRUMS, SELECTOR_ICON_IN_BREADCRUMBS, /*SELECTOR_BOOKMARK,* SELECTOR_PAYWALL,*/ SELECTOR_HEADING/*, SELECTOR_REVIEW_IMAGE*/ } = context.selectors;

    document.querySelectorAll('form.annotator-widget').forEach((el) => el.remove()); // define constant
    document.querySelectorAll('svg.fa-home').forEach((el) => el.remove());

    var con = document.querySelector('#root > main > div.container-fluid'); // define constant for the selector : const SELECTOR_CONTENT_CONTAINER = '#root > main > div.container-fluid';
    heading = con.querySelector(SELECTOR_HEADING);


    const bc = document.querySelector(SELECTOR_BREADCRUMS).cloneNode(true); // why node is cloned ?
    const breadcrumItems = [...bc.children].map(e => e.innerText).filter(e => e.trim().length);

    /*
    // replace fonticons in breadcrums
    bc.querySelectorAll(SELECTOR_ICON_IN_BREADCRUMBS).forEach((el) => el.replaceWith((() => {
        span = document.createElement('span');
        span.innerText = " > ";
        return span;
    })()))
    */
    var tabIndicatorEl = bc.querySelector('li:nth-child(2)').cloneNode(true)
    tabIndicatorEl.innerText = `${context.tabInfo[0]}/${context.tabInfo[1]}`;
    bc.appendChild(tabIndicatorEl);

    /*
    bc.append((([tabNo, totalTabs]) => {
        sp = document.createElement('span');
        sp.innerText = " " + tabNo + " / " + totalTabs;
        sp.classList.add("tab-count");
        return sp;
    })(context.tabInfo))
    */

    // coloring breadcrums
    bc.style.background = "#EEE";

    // TODOmake changed part in bold / diff colouring

    headerDiv = document.createElement('div');
    headerDiv.style.marginBottom = '20px';
    headerDiv.classList.add('header');
    headerDiv.appendChild(heading);
    headerDiv.appendChild(bc);

    return {
        breadcrumItems: breadcrumItems,
        headerHtml: headerDiv.outerHTML
    }
}


// find index of first difference in two arrays
const diffIndex = async function (a, b) {
    i = 0;
    while (i < Math.min(a.length, b.length)) {
        if (a[i] != b[i])
            return { index: i, value: b[i], type: "diff" };
        i++;
    }
    if (i < b.length)
        return { index: i, value: b[i], type: "more in 2nd arg" };
    if (i < a.length)
        return { index: i, value: a[i], type: "missing in 2nd arg" };

    return { index: -1, value: null, type: "same" };
}


const savePage = async function (page, pathName, format) {
    // file size needs to be optimized
    // its samller than html page saved from browser(~8Mb), 
    // but still huge(~2.5Mb) for amount of content
    // shedding objects from template aggrigator page might help
    // Bare Html page w/o any resources is just <63kb
    console.log('Writing File : ', pathName);
    if (['mhtml', 'mht'].indexOf(format.trim().toLowerCase()) > -1)
        try {
            const cdp = await page.target().createCDPSession();
            const { data } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });

            if (!(pathName.endsWith(".mhtml") || pathName.endsWith(".mht")))
                pathName += '.mhtml'
            fs.writeFileSync(pathName, data);
            console.log('Done Writing File.');
        } catch (err) {
            console.error(err);
        }
    else if (['html', 'htm'].indexOf(format.trim().toLowerCase()) > -1)
        try {
            console.log(format + ' not yet implemented');

            if (!(pathName.endsWith(".htm") || pathName.endsWith(".html")))
                pathName += '.html'

        } catch (err) {
            console.error(err);
        }
    else if (format.trim().toLowerCase() == 'epub')
        try {
            console.log(format + ' not yet implemented');

            if (!pathName.endsWith(".epub"))
                pathName += '.epub';

        } catch (err) {
            console.error(err);
        }
    else {
        console.log('Unsupported format');
    }
}
