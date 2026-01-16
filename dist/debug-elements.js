import { chromium } from 'playwright';
async function debugElements() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://gmodelo.deltaxbeta.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Extraer elementos interactivos
    const elements = await page.evaluate(() => {
        const selectors = ['input', 'button', 'a', '[type="submit"]', '[role="button"]'];
        const results = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const element = el;
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0)
                    return;
                results.push({
                    tag: element.tagName.toLowerCase(),
                    type: element.getAttribute('type'),
                    id: element.id,
                    name: element.getAttribute('name'),
                    class: element.className,
                    placeholder: element.getAttribute('placeholder'),
                    text: element.textContent?.trim().substring(0, 50),
                    outerHTML: element.outerHTML.substring(0, 200)
                });
            });
        });
        return results;
    });
    console.log('\n📋 ELEMENTOS INTERACTIVOS ENCONTRADOS:\n');
    elements.forEach((el, i) => {
        console.log(`${i + 1}. <${el.tag}>`);
        console.log(`   type: ${el.type}`);
        console.log(`   id: ${el.id}`);
        console.log(`   name: ${el.name}`);
        console.log(`   class: ${el.class}`);
        console.log(`   placeholder: ${el.placeholder}`);
        console.log(`   text: ${el.text}`);
        console.log(`   HTML: ${el.outerHTML}`);
        console.log('');
    });
    await page.waitForTimeout(5000);
    await browser.close();
}
debugElements().catch(console.error);
//# sourceMappingURL=debug-elements.js.map