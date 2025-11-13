export const sendSMS = async ({ to, message }) => {
  if (!to) {
    throw new Error('Destination number is required');
  }

  if (!message) {
    throw new Error('Message content is required');
  }

  console.log(`[SMS MOCK] -> ${to}: ${message}`);
  return { success: true, provider: 'mock' };
};


