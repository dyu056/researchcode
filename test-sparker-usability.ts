import { chromium } from "playwright"

const API_URL = "http://localhost:4096"
const DIRECTORY = "/Users/danielyu/Documents/claude_code_modifications/researchcode/packages/opencode"

// API credentials
const API_KEY = "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"
const API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const MODEL_NAME = "google/gemini-3-flash-preview"

interface TestResult {
  pass: boolean
  step: string
  error?: string
  duration: number
}

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = new URL(path, API_URL)
  // Always pass directory as a query param
  url.searchParams.set("directory", DIRECTORY)

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  }
  if (body && (method === "POST" || method === "PATCH")) {
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Test the Sparker session creation flow via API
 * This simulates the 3-step onboarding:
 * 1. Select root folder (handled by path)
 * 2. Name research topic (creates folder structure + sessions)
 * 3. Verify split view sessions created
 */
async function testSparkerFlow(runNumber: number): Promise<TestResult[]> {
  const results: TestResult[] = []
  const startTime = Date.now()

  console.log(`\n${"=".repeat(50)}`)
  console.log(`SPARKER USABILITY TEST - Run #${runNumber}`)
  console.log(`${"=".repeat(50)}\n`)

  const topicName = `Test Research ${runNumber}-${Date.now()}`
  const sparkerPath = `${DIRECTORY}/sparker/${topicName.replace(/[^a-zA-Z0-9-_ ]/g, "_")}`
  const surveyorPath = `${sparkerPath}/surveyor`

  // Step 1: Health check
  const step1Start = Date.now()
  try {
    console.log("Step 1: Health check...")
    const health = (await apiRequest("GET", "/global/health")) as { healthy?: boolean }
    if (!health.healthy) {
      throw new Error("Server not healthy")
    }
    results.push({
      pass: true,
      step: "health_check",
      duration: Date.now() - step1Start,
    })
    console.log(`  ✓ Server is healthy (${Date.now() - step1Start}ms)`)
  } catch (error) {
    results.push({
      pass: false,
      step: "health_check",
      error: String(error),
      duration: Date.now() - step1Start,
    })
    console.log(`  ✗ Health check failed: ${error}`)
    return results
  }

  // Step 2: Create Sparker session (main session)
  const step2Start = Date.now()
  try {
    console.log("Step 2: Creating Sparker session...")
    const sparkerSession = (await apiRequest("POST", "/session", {
      title: `${topicName} - Sparker`,
      model: {
        apiKey: API_KEY,
        apiEndpoint: API_ENDPOINT,
        providerID: "openrouter",
        modelName: MODEL_NAME,
      },
    })) as { id?: string; error?: string }

    if (!sparkerSession.id) {
      throw new Error(sparkerSession.error || "No session ID returned")
    }

    results.push({
      pass: true,
      step: "create_sparke_session",
      duration: Date.now() - step2Start,
    })
    console.log(`  ✓ Sparker session created: ${sparkerSession.id} (${Date.now() - step2Start}ms)`)

    // Step 3: Create Surveyor session
    const step3Start = Date.now()
    console.log("Step 3: Creating Surveyor session...")
    const surveyorSession = (await apiRequest("POST", "/session", {
      title: `${topicName} - Surveyor`,
      model: {
        apiKey: API_KEY,
        apiEndpoint: API_ENDPOINT,
        providerID: "openrouter",
        modelName: MODEL_NAME,
      },
    })) as { id?: string; error?: string }

    if (!surveyorSession.id) {
      throw new Error(surveyorSession.error || "No session ID returned")
    }

    results.push({
      pass: true,
      step: "create_surveyor_session",
      duration: Date.now() - step3Start,
    })
    console.log(`  ✓ Surveyor session created: ${surveyorSession.id} (${Date.now() - step3Start}ms)`)

    // Step 4: Verify both sessions exist
    const step4Start = Date.now()
    console.log("Step 4: Verifying sessions exist...")
    await sleep(1000) // Wait for sessions to be indexed

    const sessions = (await apiRequest("GET", "/session")) as Array<{ id: string; title: string }>
    const sparkerExists = sessions.some((s) => s.id === sparkerSession.id)
    const surveyorExists = sessions.some((s) => s.id === surveyorSession.id)

    if (!sparkerExists || !surveyorExists) {
      throw new Error(
        `Sessions not found - Sparker: ${sparkerExists}, Surveyor: ${surveyorExists}`,
      )
    }

    results.push({
      pass: true,
      step: "verify_sessions",
      duration: Date.now() - step4Start,
    })
    console.log(`  ✓ Both sessions verified (${Date.now() - step4Start}ms)`)

    // Step 5: Send message to Sparker session
    const step5Start = Date.now()
    console.log("Step 5: Sending message to Sparker session...")
    const promptResponse = await fetch(
      `${API_URL}/session/${sparkerSession.id}/prompt_async?directory=${encodeURIComponent(DIRECTORY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: `Confirm you received this research topic: ${topicName}` }],
        }),
      },
    )

    if (!promptResponse.ok) {
      throw new Error(`Prompt request failed: ${promptResponse.status}`)
    }

    results.push({
      pass: true,
      step: "send_sparker_message",
      duration: Date.now() - step5Start,
    })
    console.log(`  ✓ Message sent to Sparker session (${Date.now() - step5Start}ms)`)

    // Step 6: Verify message was received
    const step6Start = Date.now()
    console.log("Step 6: Verifying message received...")
    await sleep(3000) // Wait for message processing

    const messages = (await apiRequest("GET", `/session/${sparkerSession.id}/message`)) as Array<{
      info?: { role?: string }
    }>
    const hasUserMessage = messages.some((m) => m.info?.role === "user")

    if (!hasUserMessage) {
      throw new Error("No user message found in Sparker session")
    }

    results.push({
      pass: true,
      step: "verify_message",
      duration: Date.now() - step6Start,
    })
    console.log(`  ✓ Message verified in session (${Date.now() - step6Start}ms)`)

    // Step 7: Test relay from Sparker to Surveyor
    const step7Start = Date.now()
    console.log("Step 7: Testing relay functionality...")
    const relayResponse = (await apiRequest("POST", `/session/${sparkerSession.id}/relay`, {
      targetSessionID: surveyorSession.id,
      content: `Research findings on: ${topicName}`,
    })) as { success?: boolean }

    if (!relayResponse.success) {
      throw new Error("Relay failed")
    }

    results.push({
      pass: true,
      step: "test_relay",
      duration: Date.now() - step7Start,
    })
    console.log(`  ✓ Relay to Surveyor successful (${Date.now() - step7Start}ms)`)

    // Cleanup
    console.log("Cleaning up sessions...")
    await apiRequest("DELETE", `/session/${sparkerSession.id}`)
    await apiRequest("DELETE", `/session/${surveyorSession.id}`)
    console.log("  ✓ Sessions deleted")

  } catch (error) {
    results.push({
      pass: false,
      step: "sparker_flow",
      error: String(error),
      duration: Date.now() - startTime,
    })
    console.log(`  ✗ Sparker flow failed: ${error}`)
  }

  return results
}

async function runConsecutiveTests(count: number): Promise<void> {
  console.log("\n" + "=".repeat(60))
  console.log("SPARKER USABILITY TEST SUITE - 10 Consecutive Passes")
  console.log("=".repeat(60))

  const allResults: TestResult[] = []
  let passCount = 0
  let failCount = 0

  for (let i = 1; i <= count; i++) {
    const results = await testSparkerFlow(i)
    allResults.push(...results)

    const passed = results.every((r) => r.pass)
    if (passed) {
      passCount++
      console.log(`\n✅ Run #${i} PASSED`)
    } else {
      failCount++
      console.log(`\n❌ Run #${i} FAILED`)
      const failedSteps = results.filter((r) => !r.pass)
      for (const step of failedSteps) {
        console.log(`   - ${step.step}: ${step.error}`)
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("TEST SUMMARY")
  console.log("=".repeat(60))
  console.log(`Total runs: ${count}`)
  console.log(`Passed: ${passCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Success rate: ${((passCount / count) * 100).toFixed(1)}%`)

  // Step-by-step breakdown
  const stepSummary = new Map<string, { passed: number; failed: number }>()
  for (const result of allResults) {
    const existing = stepSummary.get(result.step) || { passed: 0, failed: 0 }
    if (result.pass) {
      existing.passed++
    } else {
      existing.failed++
    }
    stepSummary.set(result.step, existing)
  }

  console.log("\nStep breakdown:")
  for (const [step, counts] of stepSummary) {
    const total = counts.passed + counts.failed
    const rate = ((counts.passed / total) * 100).toFixed(1)
    console.log(`  ${step}: ${counts.passed}/${total} (${rate}%)`)
  }

  // Total duration
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0)
  console.log(`\nTotal test duration: ${(totalDuration / 1000).toFixed(2)}s`)
  console.log("=".repeat(60))

  if (failCount > 0) {
    console.log("\n⚠️  Some tests failed. Review the output above.")
    process.exit(1)
  } else {
    console.log("\n✅ All tests passed!")
  }
}

// Allow running with custom count
const count = parseInt(process.argv[2] || "10", 10)
runConsecutiveTests(count).catch((error) => {
  console.error("Test suite failed:", error)
  process.exit(1)
})
