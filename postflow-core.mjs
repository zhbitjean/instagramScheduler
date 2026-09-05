import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export const HASHTAG_POOL = [
  '#queensnails', '#longislandnails', '#flushingnails', '#nycnailtech', '#nycnails',
  '#queensnailtech', '#linails', '#longislandnailtech', '#flushingnailtech', '#astorianails',
  '#baysidenails', '#foresthillsnails', '#jamaicaqueensnails', '#nassaucountynails', '#greatnecknails',
  '#newyorknails', '#nailartnyc', '#gelnailsnyc', '#acrylicnailsnyc', '#nailinspiration',
  '#naildesign', '#nailartist', '#nailsoftheday', '#manicure', '#gelmanicure',
  '#queenssmallbusiness', '#nycbeauty', '#bookyourappointment', '#kallynail', '#dmforappointments',
];

export function sampleHashtags(min = 8, max = 12, random = Math.random) {
  const count = Math.floor(random() * (max - min + 1)) + min;
  return [...HASHTAG_POOL].sort(() => random() - 0.5).slice(0, count);
}

export function applyJitter(scheduledAt, beforeMinutes = 15, afterMinutes = 30, random = Math.random) {
  const offsetMinutes = Math.floor(random() * (beforeMinutes + afterMinutes + 1)) - beforeMinutes;
  return { triggerAt: new Date(new Date(scheduledAt).getTime() + offsetMinutes * 60_000).toISOString(), offsetMinutes };
}

export async function generateCaption({ style = '', language = 'English', imagePath = '', apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_CAPTION_MODEL || 'gpt-5.6-luna' } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const prompt = `Write one short Instagram caption in ${language} as Kally Nail, a friendly professional nail artist serving Queens and Long Island, New York. Nail style: ${style || 'infer naturally from the photo or keep it general'}. Sound human and varied, use tasteful emoji, and include a natural CTA such as DM to book. Do not add hashtags. Return only the caption.`;
  const content = [{ type: 'input_text', text: prompt }];
  if (imagePath) {
    const bytes = await readFile(imagePath);
    const mime = extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    content.push({ type: 'input_image', image_url: `data:${mime};base64,${bytes.toString('base64')}` });
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: [{ role: 'user', content }], max_output_tokens: 220 }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'OpenAI caption generation failed.');
  const caption = body.output_text || body.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!caption) throw new Error('OpenAI returned an empty caption.');
  return caption.trim();
}

export async function dryRunTest({ imagePath, style = '', language = 'English', scheduledAt = new Date(Date.now() + 60_000).toISOString() }) {
  const caption = await generateCaption({ style, language, imagePath });
  const hashtags = sampleHashtags();
  const jitter = applyJitter(scheduledAt);
  return { dryRun: true, media: { path: imagePath, type: 'image' }, caption, hashtags, finalText: `${caption}\n\n${hashtags.join(' ')}`, scheduledAt, ...jitter, publish: { provider: 'instagram', executed: false } };
}
