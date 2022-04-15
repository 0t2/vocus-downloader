import { chromium, Page } from "playwright";

const timeout = 100000;

(async () => {
    const browser = await chromium.launch({ headless: true, slowMo: 150 });
    const crContext = await browser.newContext();
    const page = await crContext.newPage();
    const authorUrl = "https://vocus.cc/tuna/home";
    await login(page);
    const allArticleUrls = await getAllArticleUrls2(authorUrl, page);
    let author = await page.$eval("xpath=//h3[contains(@class,'sc-')]", author => author.textContent);
    author = author!.replace(/[/\\?%*:|"<>]/g, '-').replace(/[\s\b]/g, '');
    console.log(allArticleUrls, author, allArticleUrls.length);
    for (let index = 231; index < allArticleUrls.length; index++) {
        const url = allArticleUrls[index];
        console.log(index, url);
        await downloadPDF(url, author!, page);
    }
    await browser.close();
})();

async function login(page: Page) {
    console.log("start to login");
    await page.goto("https://vocus.cc/", { timeout, waitUntil: "load" });
    await page.waitForSelector("xpath=//div[contains(@class,'header__HeaderContainer')]//button[contains(text(),'登入')]", { timeout });
    await page.click("xpath=//div[contains(@class,'header__HeaderContainer')]//button[contains(text(),'登入')]");
    await page.waitForSelector("input[placeholder='方格子帳號（電子郵件）']", { timeout });
    await page.fill("input[placeholder='方格子帳號（電子郵件）']", "YOUR_EMAIL");
    await page.fill("input[placeholder='密碼']", "YOUR_PASSWORD");
    await page.click("xpath=//div[starts-with(@class,'loginModal__LoginContentWrapper')]//button[contains(text(),'登入')]");
    await page.waitForSelector("div[class^='userDropdown__Toggler']", { timeout });
    console.log("login finished");
}

async function getAllArticleUrls(url: string, page: Page) {
    await Promise.all([
        page.waitForNavigation({ timeout, waitUntil: "networkidle" }),
        page.goto(url)
    ]);
    const totalPage = await page.evaluate(() => document.querySelectorAll("ul[class='pagination']>li").length);
    let articleUrls: string[] = await page.$$eval(".articleList-title a", links => links.map(a => (<HTMLLinkElement>(<any>a)).href));
    for (let i = 0; i < totalPage - 1; i++) {
        await Promise.all([
            page.waitForNavigation({ timeout, waitUntil: "domcontentloaded" }),
            page.click('a[aria-label=Next]'),
            page.waitForSelector(".articleList", { timeout, state: "detached" }),
            page.waitForSelector(".articleList", { timeout }),
        ]);
        let urls = await page.$$eval(".articleList-title a", links => links.map(a => (<HTMLLinkElement>(<any>a)).href));
        articleUrls.push(...urls);
    }
    return articleUrls;
}

async function getAllArticleUrls2(url: string, page: Page) {
    console.log("start to get all articles");
    await Promise.all([
        page.waitForNavigation({ timeout, waitUntil: "networkidle" }),
        page.goto(url)
    ]);
    await page.evaluate(() => new Promise<void>((resolve) => {
        let scrollTop = -1;
        const interval = setInterval(() => {
            window.scrollBy(0, 100);
            if (document.documentElement.scrollTop !== scrollTop) {
                scrollTop = document.documentElement.scrollTop;
                return;
            }
            clearInterval(interval);
            resolve();
        }, 500);
    }));
    console.log("finished getting all articles");
    return await page.$$eval("xpath=//div[contains(text(),'付費限定') or contains(text(),'Premium')]/following-sibling::div//h3[@class='articleList-title']/..", links => links.map(a => (<HTMLLinkElement>(<any>a)).href));
}

async function downloadPDF(url: string, author: string, page: Page) {
    await page.goto(url);
    await page.evaluate(() => new Promise<void>((resolve) => {
        let scrollTop = -1;
        const interval = setInterval(() => {
            window.scrollBy(0, 100);
            if (document.documentElement.scrollTop !== scrollTop) {
                scrollTop = document.documentElement.scrollTop;
                return;
            }
            clearInterval(interval);
            resolve();
        }, 100);
    }));
    // let title: string | undefined = "";
    const date = await page.$eval('.time', time => time.textContent);
    const originalTitle = await page.evaluate(() => {
        document.querySelector("div[class^='header__CompressedHeaderContainer']")?.remove();
        document.querySelector("div[class^='navigation__NavContainer']")?.remove();
        document.querySelector("div[class^='header__HeaderContainer']")?.remove();
        document.querySelector("div[class^='articlePagestyle__MobileFixedContainer']")?.remove();
        return document.querySelector("h1[class^='articlePagestyle__ArticleTitle']")?.textContent?.trim();
    });
    const title = originalTitle ? `${originalTitle.replace(/[/\\?%*:|"<>]/g, '-').replace(/[\s\b]/g, '')}.pdf` : `${Date.now()}.pdf`;
    const pdfOptions = {
        path: `${author}/${date} ${title}`,
    };
    console.log(pdfOptions);
    page.waitForTimeout(10000);
    await page.pdf(pdfOptions);
}

