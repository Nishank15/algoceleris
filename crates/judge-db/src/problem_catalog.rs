//! Canonical server-side problem catalog.
//!
//! Problem definitions and every test case (sample and hidden) live here so the
//! browser cannot influence grading: the public catalog endpoints serve sample cases
//! only, while the submission pipeline builds the worker payload from this same
//! catalog (mirrored into the `problems` / `problem_test_cases` tables in PostgreSQL
//! by the idempotent startup seeder).

/// A single immutable test case owned by the server.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogTestCase {
    /// 1-based position within the problem's full case list.
    pub ordinal: i32,
    /// Standard input fed to the candidate program.
    pub input_data: &'static str,
    /// Expected standard output.
    pub expected_output: &'static str,
    /// Whether the case is publicly visible in the catalog UI.
    pub is_sample: bool,
}

/// A problem definition together with its authoritative case list.
#[derive(Debug, Clone)]
pub struct CatalogProblem {
    /// URL-safe problem slug (primary key).
    pub id: &'static str,
    /// Display title, including the original `LeetCode` numbering.
    pub title: &'static str,
    /// Difficulty label (`Easy`, `Medium`, `Hard`).
    pub difficulty: &'static str,
    /// Historical acceptance rate shown in the catalog.
    pub acceptance_rate: f64,
    /// Algorithmic topic tags.
    pub tags: &'static [&'static str],
    /// Markdown statement shown in the workspace.
    pub description: &'static str,
    /// Statement constraints.
    pub constraints: &'static [&'static str],
    /// Per-case time limit in milliseconds.
    pub time_limit_ms: i32,
    /// Per-case memory limit in bytes.
    pub memory_limit_bytes: i64,
    /// Full case list: sample cases first, hidden cases afterwards.
    pub cases: &'static [CatalogTestCase],
}

/// Returns the canonical server-side problem catalog.
#[must_use]
pub fn catalog() -> &'static [CatalogProblem] {
    CATALOG
}

/// Looks up a problem by slug, case-insensitively.
#[must_use]
pub fn find(problem_id: &str) -> Option<&'static CatalogProblem> {
    let needle = problem_id.trim().to_lowercase();
    CATALOG.iter().find(|p| p.id == needle)
}

/// Canonical problem catalog served by the gateway and seeded into PostgreSQL.
pub static CATALOG: &[CatalogProblem] = &[
    CatalogProblem {
        id: "two-sum",
        title: "1. Two Sum",
        difficulty: "Easy",
        acceptance_rate: 49.5,
        tags: &[
            "Array",
            "Hash Table",
            ],
        description: "Given an array of integers `nums` and an integer `target`, return the **0-indexed indices** of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nOutput the two indices separated by a single space in increasing order.",
        constraints: &[
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Only one valid answer exists.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "4\n2 7 11 15\n9",
                    expected_output: "0 1",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "3\n3 2 4\n6",
                    expected_output: "1 2",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 3,
                    input_data: "2\n3 3\n6",
                    expected_output: "0 1",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 4,
                    input_data: "5\n1 5 3 7 9\n12",
                    expected_output: "1 3",
                    is_sample: false,
                },
                CatalogTestCase {
                    ordinal: 5,
                    input_data: "6\n-3 4 3 90 2 1\n0",
                    expected_output: "0 2",
                    is_sample: false,
                },
        ],
    },
    CatalogProblem {
        id: "valid-palindrome",
        title: "125. Valid Palindrome",
        difficulty: "Easy",
        acceptance_rate: 44.8,
        tags: &[
            "String",
            "Two Pointers",
            ],
        description: "A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string `s`, output `true` if it is a palindrome, or `false` otherwise.",
        constraints: &[
            "1 <= s.length <= 2 * 10^5",
            "s consists only of printable ASCII characters.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "A man, a plan, a canal: Panama",
                    expected_output: "true",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "race a car",
                    expected_output: "false",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 3,
                    input_data: " ",
                    expected_output: "true",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "climbing-stairs",
        title: "70. Climbing Stairs",
        difficulty: "Easy",
        acceptance_rate: 52.3,
        tags: &[
            "Dynamic Programming",
            "Math",
            ],
        description: "You are climbing a staircase. It takes `n` steps to reach the top.\n\nEach time you can either climb `1` or `2` steps. In how many distinct ways can you climb to the top?",
        constraints: &[
            "1 <= n <= 45",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "2",
                    expected_output: "2",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "3",
                    expected_output: "3",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 3,
                    input_data: "5",
                    expected_output: "8",
                    is_sample: false,
                },
                CatalogTestCase {
                    ordinal: 4,
                    input_data: "10",
                    expected_output: "89",
                    is_sample: false,
                },
        ],
    },
    CatalogProblem {
        id: "invert-binary-tree",
        title: "226. Invert Binary Tree",
        difficulty: "Easy",
        acceptance_rate: 75.1,
        tags: &[
            "Trees",
            "DFS",
            "BFS",
            ],
        description: "Given the root of a binary tree, invert the tree, and return its level-order representation.",
        constraints: &[
            "The number of nodes in the tree is in the range [0, 100].",
            "-100 <= Node.val <= 100",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "4 2 7 1 3 6 9",
                    expected_output: "4 7 2 9 6 3 1",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "2 1 3",
                    expected_output: "2 3 1",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "longest-substring",
        title: "3. Longest Substring Without Repeating Characters",
        difficulty: "Medium",
        acceptance_rate: 34.2,
        tags: &[
            "String",
            "Sliding Window",
            "Hash Table",
            ],
        description: "Given a string `s`, find the length of the **longest substring** without repeating characters.\n\nOutput a single integer representing the maximum length.",
        constraints: &[
            "0 <= s.length <= 5 * 10^4",
            "s consists of English letters, digits, symbols and spaces.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "abcabcbb",
                    expected_output: "3",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "bbbbb",
                    expected_output: "1",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 3,
                    input_data: "pwwkew",
                    expected_output: "3",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "coin-change",
        title: "322. Coin Change",
        difficulty: "Medium",
        acceptance_rate: 42.1,
        tags: &[
            "Dynamic Programming",
            "BFS",
            ],
        description: "You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money.\n\nReturn the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return `-1`.",
        constraints: &[
            "1 <= coins.length <= 12",
            "1 <= coins[i] <= 2^31 - 1",
            "0 <= amount <= 10^4",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "3\n1 2 5\n11",
                    expected_output: "3",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "1\n2\n3",
                    expected_output: "-1",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "maximum-subarray",
        title: "53. Maximum Subarray",
        difficulty: "Medium",
        acceptance_rate: 50.4,
        tags: &[
            "Array",
            "Dynamic Programming",
            "Divide and Conquer",
            ],
        description: "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.",
        constraints: &[
            "1 <= nums.length <= 10^5",
            "-10^4 <= nums[i] <= 10^4",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "9\n-2 1 -3 4 -1 2 1 -5 4",
                    expected_output: "6",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "1\n1",
                    expected_output: "1",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "course-schedule",
        title: "207. Course Schedule",
        difficulty: "Medium",
        acceptance_rate: 46.5,
        tags: &[
            "Graph",
            "Topological Sort",
            "BFS",
            "DFS",
            ],
        description: "There are a total of `numCourses` courses you have to take, labeled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [ai, bi]` indicates that you must take course `bi` first if you want to take course `ai`.\n\nReturn `true` if you can finish all courses. Otherwise, return `false`.",
        constraints: &[
            "1 <= numCourses <= 2000",
            "0 <= prerequisites.length <= 5000",
            "prerequisites[i].length == 2",
            "All the pairs prerequisites[i] are unique.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "2\n1\n1 0",
                    expected_output: "true",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "2\n2\n1 0\n0 1",
                    expected_output: "false",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "search-rotated-array",
        title: "33. Search in Rotated Sorted Array",
        difficulty: "Medium",
        acceptance_rate: 39.2,
        tags: &[
            "Binary Search",
            "Array",
            ],
        description: "There is an integer array `nums` sorted in ascending order (with distinct values). Prior to being passed to your function, `nums` is possibly rotated at an unknown pivot index.\n\nGiven the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`. You must write an algorithm with `O(log n)` runtime complexity.",
        constraints: &[
            "1 <= nums.length <= 5000",
            "-10^4 <= nums[i] <= 10^4",
            "All values of nums are unique.",
            "nums is guaranteed to be rotated at some pivot.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "7\n4 5 6 7 0 1 2\n0",
                    expected_output: "4",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "7\n4 5 6 7 0 1 2\n3",
                    expected_output: "-1",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "median-two-sorted-arrays",
        title: "4. Median of Two Sorted Arrays",
        difficulty: "Hard",
        acceptance_rate: 36.8,
        tags: &[
            "Binary Search",
            "Array",
            "Divide and Conquer",
            ],
        description: "Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the **median** of the two sorted arrays.\n\nThe overall run time complexity should be `O(log (m+n))`.",
        constraints: &[
            "nums1.length == m",
            "nums2.length == n",
            "0 <= m <= 1000",
            "0 <= n <= 1000",
            "1 <= m + n <= 2000",
            "-10^6 <= nums1[i], nums2[i] <= 10^6",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "2\n1 3\n1\n2",
                    expected_output: "2.00000",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "2\n1 2\n2\n3 4",
                    expected_output: "2.50000",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "trapping-rain-water",
        title: "42. Trapping Rain Water",
        difficulty: "Hard",
        acceptance_rate: 59.8,
        tags: &[
            "Array",
            "Two Pointers",
            "Stack",
            ],
        description: "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
        constraints: &[
            "n == height.length",
            "1 <= n <= 2 * 10^4",
            "0 <= height[i] <= 10^5",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "12\n0 1 0 2 1 0 1 3 2 1 2 1",
                    expected_output: "6",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "6\n4 2 0 3 2 5",
                    expected_output: "9",
                    is_sample: true,
                },
        ],
    },
    CatalogProblem {
        id: "word-ladder",
        title: "127. Word Ladder",
        difficulty: "Hard",
        acceptance_rate: 37.6,
        tags: &[
            "Graph",
            "BFS",
            "Hash Table",
            "String",
            ],
        description: "A **transformation sequence** from word `beginWord` to word `endWord` using a dictionary `wordList` is a sequence of words `beginWord -> s1 -> s2 -> ... -> sk` such that every adjacent pair of words differs by a single letter.\n\nReturn the **number of words** in the shortest transformation sequence from `beginWord` to `endWord`, or `0` if no such sequence exists.",
        constraints: &[
            "1 <= beginWord.length <= 10",
            "endWord.length == beginWord.length",
            "1 <= wordList.length <= 5000",
            "wordList[i].length == beginWord.length",
            "beginWord, endWord, and wordList[i] consist of lowercase English letters.",
            "beginWord != endWord",
            "All the words in wordList are unique.",
            ],
        time_limit_ms: 2000,
        memory_limit_bytes: 268_435_456,
        cases: &[
                CatalogTestCase {
                    ordinal: 1,
                    input_data: "hit\ncog\n6\nhot dot dog lot log cog",
                    expected_output: "5",
                    is_sample: true,
                },
                CatalogTestCase {
                    ordinal: 2,
                    input_data: "hit\ncog\n5\nhot dot dog lot log",
                    expected_output: "0",
                    is_sample: true,
                },
        ],
    },
];
