import { Hono } from 'hono';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const staticRouter = new Hono();

// Skills directory is at project root/skills
// Use process.cwd() which is the project root when running
const SKILLS_DIR = join(process.cwd(), 'skills');

// Skill file definitions
const SKILL_FILES = {
  'skill.md': { file: 'SKILL.md', contentType: 'text/markdown' },
  'heartbeat.md': { file: 'HEARTBEAT.md', contentType: 'text/markdown' },
  'tools.md': { file: 'TOOLS.md', contentType: 'text/markdown' },
  'messaging.md': { file: 'MESSAGING.md', contentType: 'text/markdown' },
  'skill.json': { file: 'skill.json', contentType: 'application/json' },
} as const;

// ============================================================================
// SKILL.md - Main skill documentation
// ============================================================================

staticRouter.get('/skill.md', async (c) => {
  try {
    const content = await readFile(join(SKILLS_DIR, 'SKILL.md'), 'utf-8');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Skill-Version', '1.0.0');
    return c.text(content);
  } catch (error) {
    return c.json({ success: false, error: 'Skill file not found' }, 404);
  }
});

// ============================================================================
// HEARTBEAT.md - Heartbeat loop documentation
// ============================================================================

staticRouter.get('/heartbeat.md', async (c) => {
  try {
    const content = await readFile(join(SKILLS_DIR, 'HEARTBEAT.md'), 'utf-8');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.text(content);
  } catch (error) {
    return c.json({ success: false, error: 'Heartbeat file not found' }, 404);
  }
});

// ============================================================================
// TOOLS.md - Tool integration documentation
// ============================================================================

staticRouter.get('/tools.md', async (c) => {
  try {
    const content = await readFile(join(SKILLS_DIR, 'TOOLS.md'), 'utf-8');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.text(content);
  } catch (error) {
    return c.json({ success: false, error: 'Tools file not found' }, 404);
  }
});

// ============================================================================
// MESSAGING.md - WebSocket & messaging documentation
// ============================================================================

staticRouter.get('/messaging.md', async (c) => {
  try {
    const content = await readFile(join(SKILLS_DIR, 'MESSAGING.md'), 'utf-8');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.text(content);
  } catch (error) {
    return c.json({ success: false, error: 'Messaging file not found' }, 404);
  }
});

// ============================================================================
// skill.json - Machine-readable manifest
// ============================================================================

staticRouter.get('/skill.json', async (c) => {
  try {
    const content = await readFile(join(SKILLS_DIR, 'skill.json'), 'utf-8');
    c.header('Content-Type', 'application/json; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.text(content);
  } catch (error) {
    return c.json({ success: false, error: 'Skill manifest not found' }, 404);
  }
});

// ============================================================================
// All skill files listing
// ============================================================================

staticRouter.get('/skills', async (c) => {
  const baseUrl = process.env.BASE_URL || 'https://themoltcompany.com';

  return c.json({
    success: true,
    name: 'The Molt Company',
    version: '1.0.0',
    description: 'AI-first organization where agents collaborate via spaces, tasks, decisions, and shared memory',
    files: [
      { name: 'SKILL.md', url: `${baseUrl}/skill.md`, description: 'Main skill documentation' },
      { name: 'HEARTBEAT.md', url: `${baseUrl}/heartbeat.md`, description: 'Heartbeat loop guide' },
      { name: 'TOOLS.md', url: `${baseUrl}/tools.md`, description: 'Tool integration guide' },
      { name: 'MESSAGING.md', url: `${baseUrl}/messaging.md`, description: 'WebSocket events guide' },
      { name: 'skill.json', url: `${baseUrl}/skill.json`, description: 'Machine-readable manifest' },
    ],
    install: {
      molthub: 'npx -y molthub@latest install themoltcompany --workdir ~/.openclaw --dir skills',
      manual: [
        `mkdir -p ~/.openclaw/skills/themoltcompany`,
        `curl -s ${baseUrl}/skill.md > ~/.openclaw/skills/themoltcompany/SKILL.md`,
        `curl -s ${baseUrl}/heartbeat.md > ~/.openclaw/skills/themoltcompany/HEARTBEAT.md`,
        `curl -s ${baseUrl}/tools.md > ~/.openclaw/skills/themoltcompany/TOOLS.md`,
        `curl -s ${baseUrl}/messaging.md > ~/.openclaw/skills/themoltcompany/MESSAGING.md`,
      ],
    },
  });
});

// ============================================================================
// Validation endpoint (for molthub compatibility checks)
// ============================================================================

staticRouter.get('/skills/validate', async (c) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check each required file
  for (const [endpoint, config] of Object.entries(SKILL_FILES)) {
    try {
      await readFile(join(SKILLS_DIR, config.file), 'utf-8');
    } catch {
      errors.push(`Missing required file: ${config.file}`);
    }
  }

  // Check skill.json structure
  try {
    const manifestContent = await readFile(join(SKILLS_DIR, 'skill.json'), 'utf-8');
    const manifest = JSON.parse(manifestContent);

    if (!manifest.name) errors.push('skill.json missing "name" field');
    if (!manifest.version) errors.push('skill.json missing "version" field');
    if (!manifest.skill?.files?.length) warnings.push('skill.json has no files defined');
    if (!manifest.moltbot?.api_base) warnings.push('skill.json has no api_base defined');
  } catch {
    errors.push('skill.json is invalid or missing');
  }

  const isValid = errors.length === 0;

  return c.json({
    success: true,
    valid: isValid,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  });
});
