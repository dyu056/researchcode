import { createSession, sendMessage, getMessages } from './research_frontend_ml/src/api.ts';

const SERVER_URL = 'http://localhost:4096';

async function test() {
  console.log('Creating session...');
  const session = await createSession(SERVER_URL, 'test session 2');

  console.log('Sending message...');
  await sendMessage(SERVER_URL, session.id, 'I wish to fine-tune BERT for sentiment analysis on movie reviews');

  // Poll for messages over 30 seconds
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const messages = await getMessages(SERVER_URL, session.id);

    console.log(`\n--- Second ${i + 1} ---`);
    console.log('Message count:', messages.length);

    if (messages.length > 1) {
      const lastMsg = messages[messages.length - 1];
      console.log('Last message role:', lastMsg.info.role);
      console.log('Last message finish:', lastMsg.info.finish);
      console.log('Last message parts:', lastMsg.parts.map(p => p.type).join(', '));

      // Check for text content
      const textParts = lastMsg.parts.filter(p => p.type === 'text');
      if (textParts.length > 0) {
        console.log('Text content:', textParts[0].text?.substring(0, 200));
        break;
      }
    }

    if (i === 29) {
      console.log('30 seconds passed, last check:');
      console.log(JSON.stringify(messages, null, 2));
    }
  }
}

test().catch(console.error);
