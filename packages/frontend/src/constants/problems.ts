import { Problem } from '../types';

export const PROBLEMS: Problem[] = [
  {
    id: 'two-sum',
    title: '1. Two Sum',
    difficulty: 'Easy',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **0-indexed indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

Output the two indices separated by a single space in increasing order.`,
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    sampleCases: [
      {
        id: 1,
        input_data: '4\n2 7 11 15\n9',
        expected_output: '0 1',
        is_sample: true,
      },
      {
        id: 2,
        input_data: '3\n3 2 4\n6',
        expected_output: '1 2',
        is_sample: true,
      },
      {
        id: 3,
        input_data: '2\n3 3\n6',
        expected_output: '0 1',
        is_sample: true,
      },
    ],
    hiddenCases: [
      {
        id: 4,
        input_data: '5\n1 5 3 7 9\n12',
        expected_output: '1 3',
        is_sample: false,
      },
      {
        id: 5,
        input_data: '6\n-3 4 3 90 2 1\n0',
        expected_output: '0 2',
        is_sample: false,
      },
    ],
    timeLimitMs: 2000,
    memoryLimitBytes: 268435456, // 256MB
  },
  {
    id: 'valid-palindrome',
    title: '125. Valid Palindrome',
    difficulty: 'Easy',
    description: `A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, output \`true\` if it is a palindrome, or \`false\` otherwise.`,
    constraints: [
      '1 <= s.length <= 2 * 10^5',
      's consists only of printable ASCII characters.',
    ],
    sampleCases: [
      {
        id: 1,
        input_data: 'A man, a plan, a canal: Panama',
        expected_output: 'true',
        is_sample: true,
      },
      {
        id: 2,
        input_data: 'race a car',
        expected_output: 'false',
        is_sample: true,
      },
      {
        id: 3,
        input_data: ' ',
        expected_output: 'true',
        is_sample: true,
      },
    ],
    timeLimitMs: 2000,
    memoryLimitBytes: 268435456,
  },
  {
    id: 'longest-substring',
    title: '3. Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

Output a single integer representing the maximum length.`,
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
    sampleCases: [
      {
        id: 1,
        input_data: 'abcabcbb',
        expected_output: '3',
        is_sample: true,
      },
      {
        id: 2,
        input_data: 'bbbbb',
        expected_output: '1',
        is_sample: true,
      },
      {
        id: 3,
        input_data: 'pwwkew',
        expected_output: '3',
        is_sample: true,
      },
    ],
    timeLimitMs: 2000,
    memoryLimitBytes: 268435456,
  },
];
