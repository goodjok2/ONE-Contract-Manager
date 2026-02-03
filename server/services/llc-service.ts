import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface GenerateLLCNameOptions {
  address: string;
  state?: string;
  organizationId: number;
}

export interface LLCNameSuggestion {
  suggestedName: string;
  baseName: string;
  isUnique: boolean;
  alternates: string[];
}

function extractStreetName(address: string): string {
  if (!address || !address.trim()) {
    return 'Project';
  }

  const normalized = address.trim();

  const parts = normalized.split(/[,\n]/)[0].trim();

  const withoutNumbers = parts.replace(/^\d+\s*/, '');

  const words = withoutNumbers.split(/\s+/);

  const suffixes = [
    'street', 'st', 'avenue', 'ave', 'boulevard', 'blvd', 'road', 'rd',
    'drive', 'dr', 'lane', 'ln', 'way', 'court', 'ct', 'circle', 'cir',
    'place', 'pl', 'terrace', 'ter', 'trail', 'trl', 'parkway', 'pkwy',
    'highway', 'hwy', 'loop', 'path', 'alley', 'aly'
  ];

  const filteredWords = words.filter(word => 
    !suffixes.includes(word.toLowerCase())
  );

  if (filteredWords.length === 0) {
    return words[0] || 'Project';
  }

  const streetName = filteredWords.join(' ');

  return streetName.charAt(0).toUpperCase() + streetName.slice(1);
}

function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];

  let result = '';
  let remaining = num;

  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

async function checkNameExists(name: string, organizationId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM llcs WHERE LOWER(name) = LOWER($1) AND organization_id = $2`,
    [name, organizationId]
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

export async function generateLLCName(options: GenerateLLCNameOptions): Promise<LLCNameSuggestion> {
  const { address, organizationId } = options;

  const streetName = extractStreetName(address);

  const baseName = `${streetName} Project, LLC`;

  const exists = await checkNameExists(baseName, organizationId);

  if (!exists) {
    return {
      suggestedName: baseName,
      baseName: streetName,
      isUnique: true,
      alternates: []
    };
  }

  const alternates: string[] = [];
  let suggestedName: string | null = null;
  let counter = 2;

  while (counter <= 10) {
    const roman = toRoman(counter);
    const alternateName = `${streetName} Project ${roman}, LLC`;
    alternates.push(alternateName);

    const alternateExists = await checkNameExists(alternateName, organizationId);
    if (!alternateExists && suggestedName === null) {
      suggestedName = alternateName;
    }

    counter++;
  }

  return {
    suggestedName: suggestedName || alternates[alternates.length - 1],
    baseName: streetName,
    isUnique: suggestedName !== null,
    alternates: alternates.slice(0, 5)
  };
}

export async function validateLLCName(
  name: string,
  organizationId: number,
  excludeId?: number
): Promise<{ isValid: boolean; message?: string }> {
  if (!name || name.trim().length < 3) {
    return { isValid: false, message: 'LLC name must be at least 3 characters' };
  }

  let query = `SELECT id FROM llcs WHERE LOWER(name) = LOWER($1) AND organization_id = $2`;
  const params: any[] = [name.trim(), organizationId];

  if (excludeId) {
    query += ` AND id != $3`;
    params.push(excludeId);
  }

  const result = await pool.query(query, params);

  if (result.rows.length > 0) {
    return { isValid: false, message: 'An LLC with this name already exists' };
  }

  return { isValid: true };
}
