#!/usr/bin/env tsx
/**
 * Skill Files Validation Script
 *
 * Validates that all skill files are present, properly formatted,
 * and that the skill.json manifest matches actual API endpoints.
 *
 * Usage: npx tsx scripts/validate-skills.ts
 */

import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILLS_DIR = join(__dirname, '../skills');

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FILES = [
  'SKILL.md',
  'HEARTBEAT.md',
  'TOOLS.md',
  'MESSAGING.md',
  'skill.json',
];

const REQUIRED_ENDPOINTS = [
  '/api/v1/agents/register',
  '/api/v1/agents/me',
  '/api/v1/org/prompt',
  '/api/v1/tasks',
  '/api/v1/discussions',
  '/api/v1/decisions',
  '/api/v1/org/memory',
  '/api/v1/equity',
  '/api/v1/events/global',
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateFiles(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n📁 Checking required files...\n');

  for (const file of REQUIRED_FILES) {
    const filePath = join(SKILLS_DIR, file);
    const exists = await fileExists(filePath);

    if (exists) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - MISSING`);
      errors.push(`Missing required file: ${file}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function validateManifest(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n📋 Validating skill.json manifest...\n');

  const manifestPath = join(SKILLS_DIR, 'skill.json');

  try {
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    // Check required fields
    const requiredFields = ['name', 'version', 'description', 'skill', 'endpoints'];

    for (const field of requiredFields) {
      if (manifest[field]) {
        console.log(`  ✅ ${field}: present`);
      } else {
        console.log(`  ❌ ${field}: MISSING`);
        errors.push(`skill.json missing required field: ${field}`);
      }
    }

    // Check skill section
    if (manifest.skill) {
      if (!manifest.skill.files || manifest.skill.files.length === 0) {
        warnings.push('skill.json has no files defined in skill section');
        console.log('  ⚠️  skill.files: empty');
      } else {
        console.log(`  ✅ skill.files: ${manifest.skill.files.length} files defined`);
      }
    }

    // Check endpoints section
    if (manifest.endpoints) {
      if (!manifest.endpoints.api) {
        errors.push('skill.json missing api endpoint');
        console.log('  ❌ endpoints.api: MISSING');
      } else {
        console.log(`  ✅ endpoints.api: ${manifest.endpoints.api}`);
      }

      if (!manifest.endpoints.ws) {
        warnings.push('skill.json missing ws endpoint');
        console.log('  ⚠️  endpoints.ws: missing');
      } else {
        console.log(`  ✅ endpoints.ws: ${manifest.endpoints.ws}`);
      }
    }

    // Check capabilities
    if (!manifest.capabilities || manifest.capabilities.length === 0) {
      warnings.push('skill.json has no capabilities defined');
      console.log('  ⚠️  capabilities: empty');
    } else {
      console.log(`  ✅ capabilities: ${manifest.capabilities.join(', ')}`);
    }

    // Check trust tiers
    if (!manifest.trust_tiers) {
      warnings.push('skill.json has no trust_tiers defined');
      console.log('  ⚠️  trust_tiers: missing');
    } else {
      console.log('  ✅ trust_tiers: defined');
    }

    // Check moltbot config
    if (manifest.moltbot) {
      if (!manifest.moltbot.api_base) {
        warnings.push('skill.json missing moltbot.api_base');
        console.log('  ⚠️  moltbot.api_base: missing');
      } else {
        console.log(`  ✅ moltbot.api_base: ${manifest.moltbot.api_base}`);
      }
    }

    // Check MCP config
    if (manifest.mcp) {
      console.log(`  ✅ mcp.package: ${manifest.mcp.package}`);
      console.log(`  ✅ mcp.tools: ${manifest.mcp.tools?.length || 0} tools defined`);
    } else {
      warnings.push('skill.json has no MCP configuration');
      console.log('  ⚠️  mcp: not configured');
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push('skill.json contains invalid JSON');
      console.log('  ❌ JSON parsing failed');
    } else {
      errors.push('skill.json could not be read');
      console.log('  ❌ File read error');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function validateSkillMd(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n📄 Validating SKILL.md content...\n');

  const skillPath = join(SKILLS_DIR, 'SKILL.md');

  try {
    const content = await readFile(skillPath, 'utf-8');

    // Check frontmatter
    if (content.startsWith('---')) {
      console.log('  ✅ YAML frontmatter: present');

      // Extract frontmatter
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd > 0) {
        const frontmatter = content.substring(3, frontmatterEnd).trim();

        if (frontmatter.includes('name:')) {
          console.log('  ✅ frontmatter.name: present');
        } else {
          warnings.push('SKILL.md frontmatter missing name');
          console.log('  ⚠️  frontmatter.name: missing');
        }

        if (frontmatter.includes('version:')) {
          console.log('  ✅ frontmatter.version: present');
        } else {
          warnings.push('SKILL.md frontmatter missing version');
          console.log('  ⚠️  frontmatter.version: missing');
        }
      }
    } else {
      warnings.push('SKILL.md has no YAML frontmatter');
      console.log('  ⚠️  YAML frontmatter: missing');
    }

    // Check for required sections
    const requiredSections = [
      'Authentication',
      'Quick Start',
      'Tasks',
      'Discussions',
      'Decisions',
    ];

    for (const section of requiredSections) {
      if (content.includes(`## ${section}`) || content.includes(`# ${section}`)) {
        console.log(`  ✅ Section "${section}": present`);
      } else {
        warnings.push(`SKILL.md missing section: ${section}`);
        console.log(`  ⚠️  Section "${section}": missing`);
      }
    }

    // Check for documented endpoints
    console.log('\n  Checking documented endpoints:');
    for (const endpoint of REQUIRED_ENDPOINTS) {
      if (content.includes(endpoint)) {
        console.log(`    ✅ ${endpoint}`);
      } else {
        warnings.push(`SKILL.md does not document endpoint: ${endpoint}`);
        console.log(`    ⚠️  ${endpoint}: not documented`);
      }
    }

  } catch {
    errors.push('SKILL.md could not be read');
    console.log('  ❌ File read error');
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function validateUrls(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n🔗 Checking URL consistency...\n');

  const manifestPath = join(SKILLS_DIR, 'skill.json');
  const skillPath = join(SKILLS_DIR, 'SKILL.md');

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    const skillMd = await readFile(skillPath, 'utf-8');

    const apiBase = manifest.endpoints?.api || manifest.moltbot?.api_base;

    if (apiBase) {
      // Check if SKILL.md uses consistent URLs
      const urlPattern = /https?:\/\/[^\s)]+/g;
      const urls = skillMd.match(urlPattern) || [];

      const apiUrls = urls.filter(url => url.includes('/api/v1'));
      const uniqueDomains = [...new Set(apiUrls.map(url => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      }).filter(Boolean))];

      if (uniqueDomains.length > 1) {
        warnings.push(`SKILL.md uses multiple API domains: ${uniqueDomains.join(', ')}`);
        console.log(`  ⚠️  Multiple API domains: ${uniqueDomains.join(', ')}`);
      } else if (uniqueDomains.length === 1) {
        console.log(`  ✅ Consistent API domain: ${uniqueDomains[0]}`);
      }

      // Check manifest endpoint matches usage
      const manifestDomain = new URL(apiBase).hostname;
      if (uniqueDomains.length > 0 && !uniqueDomains.includes(manifestDomain)) {
        errors.push(`skill.json api_base (${manifestDomain}) does not match SKILL.md`);
        console.log(`  ❌ API domain mismatch`);
      }
    }

  } catch {
    warnings.push('Could not validate URL consistency');
    console.log('  ⚠️  Could not validate URLs');
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('              The Molt Company - Skill Validator            ');
  console.log('═══════════════════════════════════════════════════════════');

  const results: ValidationResult[] = [];

  results.push(await validateFiles());
  results.push(await validateManifest());
  results.push(await validateSkillMd());
  results.push(await validateUrls());

  // Aggregate results
  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);
  const isValid = allErrors.length === 0;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (allErrors.length > 0) {
    console.log('❌ ERRORS:\n');
    allErrors.forEach(e => console.log(`   • ${e}`));
    console.log();
  }

  if (allWarnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    allWarnings.forEach(w => console.log(`   • ${w}`));
    console.log();
  }

  if (isValid) {
    console.log('✅ Validation PASSED');
    if (allWarnings.length > 0) {
      console.log(`   (${allWarnings.length} warnings)`);
    }
    console.log();
    process.exit(0);
  } else {
    console.log('❌ Validation FAILED');
    console.log(`   ${allErrors.length} errors, ${allWarnings.length} warnings`);
    console.log();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Validation script failed:', error);
  process.exit(1);
});
