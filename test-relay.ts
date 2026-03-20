import { chromium } from 'playwright'

const API_URL = 'http://localhost:4096'
const UI_URL = 'http://localhost:3001'
const DIRECTORY = '/Users/danielyu/Documents/claude_code_modifications/researchcode/packages/opencode'

// API credentials
const API_KEY = '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'
const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL_NAME = 'google/gemini-3-flash-preview'

async function apiRequest(method: string, path: string, body?: any) {
  const url = new URL(path, API_URL)
  if (method === 'GET') {
    url.searchParams.set('directory', DIRECTORY)
  }

  const options: any = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), options)
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function testAPI() {
  console.log('=== Testing OpenCode API ===\n')

  // Test health
  console.log('1. Testing health endpoint...')
  const health = await apiRequest('GET', '/global/health')
  console.log('   Health:', health)
  if (!health.healthy) throw new Error('Server not healthy')

  // Create session 1 with model config
  console.log('\n2. Creating Session 1 with custom model...')
  const session1 = await apiRequest('POST', '/session', {
    title: 'API Test Session 1',
    model: {
      apiKey: API_KEY,
      apiEndpoint: API_ENDPOINT,
      providerID: 'openrouter',
      modelName: MODEL_NAME,
    }
  })
  console.log('   Session 1 created:', session1.id ? 'YES' : 'NO')
  console.log('   Model config:', session1.model)
  if (!session1.id) throw new Error('Failed to create session 1')
  const session1Id = session1.id

  // Create session 2
  console.log('\n3. Creating Session 2...')
  const session2 = await apiRequest('POST', '/session', {
    title: 'API Test Session 2',
    model: {
      apiKey: API_KEY,
      apiEndpoint: API_ENDPOINT,
      providerID: 'openrouter',
      modelName: MODEL_NAME,
    }
  })
  console.log('   Session 2 created:', session2.id ? 'YES' : 'NO')
  if (!session2.id) throw new Error('Failed to create session 2')
  const session2Id = session2.id

  // Test prompt endpoint (async to not block)
  console.log('\n4. Sending async message to Session 1...')
  const asyncResponse = await fetch(`${API_URL}/session/${session1Id}/prompt_async?directory=${encodeURIComponent(DIRECTORY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Say "Hello from Session 1!" in exactly 3 words' }]
    })
  })
  console.log('   Async prompt status:', asyncResponse.status)
  // Don't wait for response, just queue it

  // Wait a bit for the message to be processed
  await new Promise(r => setTimeout(r, 3000))

  // Get messages (note: endpoint is /message not /messages)
  console.log('\n5. Getting messages for Session 1...')
  const messages = await apiRequest('GET', `/session/${session1Id}/message`)
  if (Array.isArray(messages)) {
    console.log('   Messages count:', messages.length)
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      console.log('   Last message role:', lastMsg.info?.role)
      const textPart = lastMsg.parts?.find((p: any) => p.type === 'text')
      console.log('   Last message text:', textPart?.text?.substring(0, 100))
    }
  } else {
    console.log('   Messages error:', messages)
  }

  // Test relay
  console.log('\n6. Testing relay from Session 1 to Session 2...')
  const relayResponse = await apiRequest('POST', `/session/${session1Id}/relay`, {
    targetSessionID: session2Id,
    content: 'Hello from Session 1 via relay!'
  })
  console.log('   Relay success:', relayResponse.success)

  // Get relay messages for session 2
  console.log('\n7. Getting relay messages for Session 2...')
  const relayMessages = await apiRequest('GET', `/session/${session2Id}/relay`)
  if (Array.isArray(relayMessages)) {
    console.log('   Relay messages count:', relayMessages.length)
    if (relayMessages.length > 0) {
      console.log('   Latest relay:', relayMessages[relayMessages.length - 1].content)
    }
  } else {
    console.log('   Relay messages:', relayMessages)
  }

  // List all sessions
  console.log('\n8. Listing all sessions...')
  const sessions = await apiRequest('GET', '/session')
  if (Array.isArray(sessions)) {
    console.log('   Total sessions:', sessions.length)
  }

  console.log('\n=== API Tests Complete ===')
  return { session1Id, session2Id }
}

async function testUI(session1Id: string, session2Id: string) {
  console.log('\n=== Testing Relay UI ===\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to UI
    console.log('1. Navigating to UI...')
    await page.goto(UI_URL)
    await page.waitForLoadState('networkidle')
    console.log('   Page title:', await page.title())

    // Click Connect button
    console.log('\n2. Connecting to server...')
    await page.click('button:has-text("Connect")')
    await page.waitForTimeout(3000)

    // Check connection status (use first match)
    const connectedDiv = page.locator('div:has-text("Connected")').first()
    const connected = await connectedDiv.isVisible()
    console.log('   Connected status visible:', connected)

    // Check if sessions loaded
    console.log('\n3. Checking sessions...')
    await page.waitForTimeout(1000)
    const hasSession = await page.locator('text=API Test Session').first().isVisible()
    console.log('   Sessions visible:', hasSession)

    // Click on Session 1
    console.log('\n4. Opening Session 1...')
    await page.click('text=API Test Session 1')
    await page.waitForTimeout(1000)

    // Check if chat area is visible
    const chatInput = page.locator('input[placeholder*="Type a message"]')
    const chatVisible = await chatInput.isVisible()
    console.log('   Chat input visible:', chatVisible)

    // Send a message
    console.log('\n5. Sending message in chat...')
    await chatInput.fill('Hello AI!')
    await page.click('button:has-text("Send")')

    // Wait for response
    console.log('   Waiting for AI response...')
    await page.waitForTimeout(15000)

    // Check if user message appeared
    const userMsgVisible = await page.locator('text=👤 You').first().isVisible()
    console.log('   User message visible:', userMsgVisible)

    // Check for assistant message
    const assistantMsgVisible = await page.locator('text=🤖 Assistant').first().isVisible()
    console.log('   Assistant message visible:', assistantMsgVisible)

    // Test relay section
    console.log('\n6. Testing relay panel...')
    // Select target session
    const targetSelect = page.locator('#relay-target')
    if (await targetSelect.isVisible()) {
      await targetSelect.selectOption({ label: 'API Test Session 2' })
      console.log('   Selected Session 2 as target')

      // Fill relay content
      await page.locator('#relay-content').fill('Test relay message from UI!')
      console.log('   Filled relay message')

      // Click relay button
      await page.click('button:has-text("Relay Message")')
      console.log('   Clicked relay button')

      await page.waitForTimeout(2000)

      // Check relay log
      const relayLogVisible = await page.locator('text=Relay').first().isVisible()
      console.log('   Relay log updated:', relayLogVisible)
    } else {
      console.log('   Relay target select not visible (might need scroll)')
    }

    console.log('\n=== UI Tests Complete ===')

  } catch (error) {
    console.error('UI Test Error:', error)
    await page.screenshot({ path: '/tmp/error-screenshot.png' })
    console.log('   Screenshot saved to /tmp/error-screenshot.png')
  } finally {
    await browser.close()
  }
}

async function main() {
  try {
    const { session1Id, session2Id } = await testAPI()
    await testUI(session1Id, session2Id)

    console.log('\n✅ All tests completed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
