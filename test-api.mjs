import { createSession, sendMessage, getMessages, checkHealth } from './research_frontend_ml/src/api.ts';

const SERVER_URL = 'http://localhost:4096';

async function test() {
  console.log('Checking backend health...');
  const health = await checkHealth(SERVER_URL);
  console.log('Health:', health);

  console.log('\nCreating session...');
  const session = await createSession(SERVER_URL, 'test session');
  console.log('Session:', session.id);

  console.log('\nSending message...');
  await sendMessage(SERVER_URL, session.id, 'I wish to fine-tune BERT for sentiment analysis on movie reviews');
  console.log('Message sent');

  // Wait for processing
  console.log('\nWaiting 5 seconds for processing...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('\nFetching messages...');
  const messages = await getMessages(SERVER_URL, session.id);
  console.log('Number of messages:', messages.length);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`\n--- Message ${i + 1} ---`);
    console.log('Role:', msg.info.role);
    console.log('Finish:', msg.info.finish);
    console.log('Parts count:', msg.parts.length);
    for (let j = 0; j < msg.parts.length; j++) {
      const part = msg.parts[j];
      console.log(`  Part ${j + 1}: type=${part.type}, text=${part.text?.substring(0, 100) || 'N/A'}...`);
    }
  }
}

test().catch(console.error);
