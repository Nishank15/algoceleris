import { Language } from '../types';

/**
 * LeetCode-style starter stubs. Each template exposes an editable `class Solution`
 * with the canonical method signature, followed by a read-only-by-convention harness
 * that parses the judge's stdin format and prints the answer to stdout.
 */

interface ProblemSpec {
  cppSol: string;
  cppMain: string;
  pySol: string;
  pyMain: string;
  javaSol: string;
  javaMain: string;
}

const CPP_HEADER = `#include <iostream>
#include <vector>
#include <string>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <sstream>
#include <iomanip>

using namespace std;
`;

const PY_HEADER = `import sys
from typing import List
from collections import deque
`;

const JAVA_HEADER = `import java.io.*;
import java.util.*;
`;

const TREE_CPP = `struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};
`;

const TREE_PY = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;

const TREE_JAVA = `class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int x) { val = x; }
}
`;

const SPECS: Record<string, ProblemSpec> = {
  'two-sum': {
    cppSol: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    int target;
    cin >> target;
    vector<int> r = Solution().twoSum(nums, target);
    if (r.size() == 2) cout << min(r[0], r[1]) << " " << max(r[0], r[1]) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # Write your solution here
        return []`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:n + 1]]
    target = int(data[n + 1])
    r = Solution().twoSum(nums, target)
    if len(r) == 2:
        print(min(r), max(r))`,
    javaSol: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[0];
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        int[] r = new Solution().twoSum(nums, target);
        if (r.length == 2) System.out.println(Math.min(r[0], r[1]) + " " + Math.max(r[0], r[1]));
    }
}`,
  },

  'valid-palindrome': {
    cppSol: `class Solution {
public:
    bool isPalindrome(string s) {
        // Write your solution here
        return false;
    }
};`,
    cppMain: `int main() {
    string s;
    getline(cin, s);
    cout << (Solution().isPalindrome(s) ? "true" : "false") << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        # Write your solution here
        return False`,
    pyMain: `def main():
    s = sys.stdin.readline().rstrip('\\n')
    print('true' if Solution().isPalindrome(s) else 'false')`,
    javaSol: `class Solution {
    public boolean isPalindrome(String s) {
        // Write your solution here
        return false;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine();
        if (s == null) s = "";
        System.out.println(new Solution().isPalindrome(s) ? "true" : "false");
    }
}`,
  },

  'climbing-stairs': {
    cppSol: `class Solution {
public:
    int climbStairs(int n) {
        // Write your solution here
        return 0;
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    cout << Solution().climbStairs(n) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def climbStairs(self, n: int) -> int:
        # Write your solution here
        return 0`,
    pyMain: `def main():
    n = int(sys.stdin.read().split()[0])
    print(Solution().climbStairs(n))`,
    javaSol: `class Solution {
    public int climbStairs(int n) {
        // Write your solution here
        return 0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println(new Solution().climbStairs(sc.nextInt()));
    }
}`,
  },

  'invert-binary-tree': {
    cppSol: `${TREE_CPP}
class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        // Write your solution here
        return root;
    }
};`,
    cppMain: `int main() {
    // Input: level-order values of a complete binary tree
    vector<TreeNode*> nodes;
    int v;
    while (cin >> v) nodes.push_back(new TreeNode(v));
    if (nodes.empty()) return 0;
    for (size_t i = 0; i < nodes.size(); i++) {
        if (2 * i + 1 < nodes.size()) nodes[i]->left = nodes[2 * i + 1];
        if (2 * i + 2 < nodes.size()) nodes[i]->right = nodes[2 * i + 2];
    }
    TreeNode* root = Solution().invertTree(nodes[0]);
    queue<TreeNode*> q;
    if (root) q.push(root);
    bool first = true;
    while (!q.empty()) {
        TreeNode* cur = q.front(); q.pop();
        if (!first) cout << " ";
        cout << cur->val;
        first = false;
        if (cur->left) q.push(cur->left);
        if (cur->right) q.push(cur->right);
    }
    cout << "\\n";
    return 0;
}`,
    pySol: `${TREE_PY}

class Solution:
    def invertTree(self, root: TreeNode) -> TreeNode:
        # Write your solution here
        return root`,
    pyMain: `def main():
    # Input: level-order values of a complete binary tree
    vals = [int(x) for x in sys.stdin.read().split()]
    if not vals:
        return
    nodes = [TreeNode(v) for v in vals]
    for i in range(len(nodes)):
        if 2 * i + 1 < len(nodes):
            nodes[i].left = nodes[2 * i + 1]
        if 2 * i + 2 < len(nodes):
            nodes[i].right = nodes[2 * i + 2]
    root = Solution().invertTree(nodes[0])
    out = []
    q = deque([root] if root else [])
    while q:
        cur = q.popleft()
        out.append(str(cur.val))
        if cur.left:
            q.append(cur.left)
        if cur.right:
            q.append(cur.right)
    print(' '.join(out))`,
    javaSol: `${TREE_JAVA}
class Solution {
    public TreeNode invertTree(TreeNode root) {
        // Write your solution here
        return root;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        // Input: level-order values of a complete binary tree
        Scanner sc = new Scanner(System.in);
        List<TreeNode> nodes = new ArrayList<>();
        while (sc.hasNextInt()) nodes.add(new TreeNode(sc.nextInt()));
        if (nodes.isEmpty()) return;
        for (int i = 0; i < nodes.size(); i++) {
            if (2 * i + 1 < nodes.size()) nodes.get(i).left = nodes.get(2 * i + 1);
            if (2 * i + 2 < nodes.size()) nodes.get(i).right = nodes.get(2 * i + 2);
        }
        TreeNode root = new Solution().invertTree(nodes.get(0));
        StringBuilder sb = new StringBuilder();
        Deque<TreeNode> q = new ArrayDeque<>();
        if (root != null) q.add(root);
        while (!q.isEmpty()) {
            TreeNode cur = q.poll();
            if (sb.length() > 0) sb.append(" ");
            sb.append(cur.val);
            if (cur.left != null) q.add(cur.left);
            if (cur.right != null) q.add(cur.right);
        }
        System.out.println(sb);
    }
}`,
  },

  'longest-substring': {
    cppSol: `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Write your solution here
        return 0;
    }
};`,
    cppMain: `int main() {
    string s;
    getline(cin, s);
    cout << Solution().lengthOfLongestSubstring(s) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Write your solution here
        return 0`,
    pyMain: `def main():
    s = sys.stdin.readline().rstrip('\\n')
    print(Solution().lengthOfLongestSubstring(s))`,
    javaSol: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your solution here
        return 0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine();
        if (s == null) s = "";
        System.out.println(new Solution().lengthOfLongestSubstring(s));
    }
}`,
  },

  'coin-change': {
    cppSol: `class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        // Write your solution here
        return -1;
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    vector<int> coins(n);
    for (auto& x : coins) cin >> x;
    int amount;
    cin >> amount;
    cout << Solution().coinChange(coins, amount) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def coinChange(self, coins: List[int], amount: int) -> int:
        # Write your solution here
        return -1`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    coins = [int(x) for x in data[1:n + 1]]
    amount = int(data[n + 1])
    print(Solution().coinChange(coins, amount))`,
    javaSol: `class Solution {
    public int coinChange(int[] coins, int amount) {
        // Write your solution here
        return -1;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] coins = new int[n];
        for (int i = 0; i < n; i++) coins[i] = sc.nextInt();
        int amount = sc.nextInt();
        System.out.println(new Solution().coinChange(coins, amount));
    }
}`,
  },

  'maximum-subarray': {
    cppSol: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Write your solution here
        return 0;
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    cout << Solution().maxSubArray(nums) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        # Write your solution here
        return 0`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:n + 1]]
    print(Solution().maxSubArray(nums))`,
    javaSol: `class Solution {
    public int maxSubArray(int[] nums) {
        // Write your solution here
        return 0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        System.out.println(new Solution().maxSubArray(nums));
    }
}`,
  },

  'course-schedule': {
    cppSol: `class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        // Write your solution here
        return false;
    }
};`,
    cppMain: `int main() {
    int numCourses, m;
    cin >> numCourses >> m;
    vector<vector<int>> prerequisites(m, vector<int>(2));
    for (auto& p : prerequisites) cin >> p[0] >> p[1];
    cout << (Solution().canFinish(numCourses, prerequisites) ? "true" : "false") << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        # Write your solution here
        return False`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    num_courses, m = int(data[0]), int(data[1])
    prereqs = [[int(data[2 + 2 * i]), int(data[3 + 2 * i])] for i in range(m)]
    print('true' if Solution().canFinish(num_courses, prereqs) else 'false')`,
    javaSol: `class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        // Write your solution here
        return false;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int numCourses = sc.nextInt();
        int m = sc.nextInt();
        int[][] prerequisites = new int[m][2];
        for (int i = 0; i < m; i++) {
            prerequisites[i][0] = sc.nextInt();
            prerequisites[i][1] = sc.nextInt();
        }
        System.out.println(new Solution().canFinish(numCourses, prerequisites) ? "true" : "false");
    }
}`,
  },

  'search-rotated-array': {
    cppSol: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Write your solution here
        return -1;
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    int target;
    cin >> target;
    cout << Solution().search(nums, target) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def search(self, nums: List[int], target: int) -> int:
        # Write your solution here
        return -1`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:n + 1]]
    target = int(data[n + 1])
    print(Solution().search(nums, target))`,
    javaSol: `class Solution {
    public int search(int[] nums, int target) {
        // Write your solution here
        return -1;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        System.out.println(new Solution().search(nums, target));
    }
}`,
  },

  'median-two-sorted-arrays': {
    cppSol: `class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        // Write your solution here
        return 0.0;
    }
};`,
    cppMain: `int main() {
    int n, m;
    cin >> n;
    vector<int> nums1(n);
    for (auto& x : nums1) cin >> x;
    cin >> m;
    vector<int> nums2(m);
    for (auto& x : nums2) cin >> x;
    cout << fixed << setprecision(5) << Solution().findMedianSortedArrays(nums1, nums2) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:
        # Write your solution here
        return 0.0`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums1 = [int(x) for x in data[1:n + 1]]
    m = int(data[n + 1])
    nums2 = [int(x) for x in data[n + 2:n + 2 + m]]
    print('%.5f' % Solution().findMedianSortedArrays(nums1, nums2))`,
    javaSol: `class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        // Write your solution here
        return 0.0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums1 = new int[n];
        for (int i = 0; i < n; i++) nums1[i] = sc.nextInt();
        int m = sc.nextInt();
        int[] nums2 = new int[m];
        for (int i = 0; i < m; i++) nums2[i] = sc.nextInt();
        System.out.println(String.format(Locale.US, "%.5f", new Solution().findMedianSortedArrays(nums1, nums2)));
    }
}`,
  },

  'trapping-rain-water': {
    cppSol: `class Solution {
public:
    int trap(vector<int>& height) {
        // Write your solution here
        return 0;
    }
};`,
    cppMain: `int main() {
    int n;
    cin >> n;
    vector<int> height(n);
    for (auto& x : height) cin >> x;
    cout << Solution().trap(height) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def trap(self, height: List[int]) -> int:
        # Write your solution here
        return 0`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    height = [int(x) for x in data[1:n + 1]]
    print(Solution().trap(height))`,
    javaSol: `class Solution {
    public int trap(int[] height) {
        // Write your solution here
        return 0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] height = new int[n];
        for (int i = 0; i < n; i++) height[i] = sc.nextInt();
        System.out.println(new Solution().trap(height));
    }
}`,
  },

  'word-ladder': {
    cppSol: `class Solution {
public:
    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
        // Write your solution here
        return 0;
    }
};`,
    cppMain: `int main() {
    string beginWord, endWord;
    int k;
    cin >> beginWord >> endWord >> k;
    vector<string> wordList(k);
    for (auto& w : wordList) cin >> w;
    cout << Solution().ladderLength(beginWord, endWord, wordList) << "\\n";
    return 0;
}`,
    pySol: `class Solution:
    def ladderLength(self, beginWord: str, endWord: str, wordList: List[str]) -> int:
        # Write your solution here
        return 0`,
    pyMain: `def main():
    data = sys.stdin.read().split()
    begin_word, end_word, k = data[0], data[1], int(data[2])
    word_list = data[3:3 + k]
    print(Solution().ladderLength(begin_word, end_word, word_list))`,
    javaSol: `class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        // Write your solution here
        return 0;
    }
}`,
    javaMain: `public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String beginWord = sc.next();
        String endWord = sc.next();
        int k = sc.nextInt();
        List<String> wordList = new ArrayList<>();
        for (int i = 0; i < k; i++) wordList.add(sc.next());
        System.out.println(new Solution().ladderLength(beginWord, endWord, wordList));
    }
}`,
  },
};

const DEFAULT_SPEC: ProblemSpec = {
  cppSol: `class Solution {
public:
    void solve() {
        // Write your solution here
    }
};`,
  cppMain: `int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    Solution().solve();
    return 0;
}`,
  pySol: `class Solution:
    def solve(self) -> None:
        # Write your solution here
        pass`,
  pyMain: `def main():
    Solution().solve()`,
  javaSol: `class Solution {
    public void solve() {
        // Write your solution here
    }
}`,
  javaMain: `public class Main {
    public static void main(String[] args) {
        new Solution().solve();
    }
}`,
};

/**
 * Builds the per-language starter templates for a given problem id.
 * Falls back to a generic `class Solution` scaffold for unknown problems.
 */
export function getStarterTemplates(problemId: string): Record<Language, string> {
  const spec = SPECS[problemId] ?? DEFAULT_SPEC;
  return {
    cpp: `${CPP_HEADER}\n${spec.cppSol}\n\n${spec.cppMain}\n`,
    python: `${PY_HEADER}\n${spec.pySol}\n\n${spec.pyMain}\n\nif __name__ == '__main__':\n    main()\n`,
    java: `${JAVA_HEADER}\n${spec.javaSol}\n\n${spec.javaMain}\n`,
  };
}

/** Default (Two Sum) templates, kept for backwards compatibility. */
export const STARTER_TEMPLATES: Record<Language, string> = getStarterTemplates('two-sum');
