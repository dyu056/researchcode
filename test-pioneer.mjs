import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening Pioneer ML app...');
  await page.goto('http://localhost:3001');

  // Wait for app to load
  await page.waitForSelector('text=Pioneer ML', { timeout: 10000 });
  console.log('App loaded');

  // Check if connected
  const connected = await page.locator('text=Connected').count();
  console.log(`Connection status: ${connected > 0 ? 'Connected' : 'Not connected'}`);

  // Click New Session
  await page.click('text=New Session');
  console.log('Clicked New Session');

  // Fill in the session title
  await page.fill('input[placeholder*="fine-tune"]', 'fine-tune BERT for sentiment analysis on movie reviews');
  console.log('Filled session description');

  // Click Create
  await page.click('button:has-text("Create")');
  console.log('Clicked Create');

  // Wait a bit for session to be created and agent to start responding
  await page.waitForTimeout(2000);

  // Check for assistant message
  const assistantCount = await page.locator('text=Pioneer').count();
  console.log(`Pioneer messages visible: ${assistantCount}`);

  // Wait for response - check periodically
  let choicesVisible = false;
  let checks = 0;
  const maxChecks = 90; // Wait up to 90 seconds for agent to finish

  while (!choicesVisible && checks < maxChecks) {
    await page.waitForTimeout(1000);
    choicesVisible = await page.locator('text=Select an option').count() > 0;

    // Also check if there's a "Processing..." indicator
    const processing = await page.locator('text=Processing').count();
    console.log(`Check ${checks + 1}: Choices visible = ${choicesVisible}, Processing = ${processing > 0}`);

    // Log thinking block content periodically
    if (checks % 10 === 0 && checks > 0) {
      const thinkingBlocks = await page.locator('text=Thinking').count();
      console.log(`  Thinking blocks: ${thinkingBlocks}`);
    }

    checks++;
  }

  if (!choicesVisible) {
    console.log('\nNo choices appeared after max wait. Checking final state...');
    const content = await page.textContent('body');
    console.log('Final body preview:', content?.substring(0, 800));
  }

  // Take a screenshot
  await page.screenshot({ path: 'pioneer-test-result.png' });
  console.log('Screenshot saved to pioneer-test-result.png');

  // Final state
  const finalChoices = await page.locator('text=Select an option').count();
  console.log(`\nFinal state: Choices visible = ${finalChoices > 0}`);

  await browser.close();
})();
