import { Language } from '../types';

export const STARTER_TEMPLATES: Record<Language, string> = {
  cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (cin >> n) {
        vector<int> nums(n);
        for (int i = 0; i < n; ++i) {
            cin >> nums[i];
        }
        int target;
        cin >> target;

        unordered_map<int, int> seen;
        for (int i = 0; i < n; ++i) {
            int complement = target - nums[i];
            if (seen.find(complement) != seen.end()) {
                cout << seen[complement] << " " << i << "\n";
                return 0;
            }
            seen[nums[i]] = i;
        }
    }
    return 0;
}
`,

  python: `import sys

def solve():
    data = sys.stdin.read().split()
    if not data:
        return
    n = int(data[0])
    nums = [int(x) for x in data[1:n+1]]
    target = int(data[n+1])

    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            print(f"{seen[complement]} {i}")
            return
        seen[num] = i

if __name__ == '__main__':
    solve()
`,

  java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line == null || line.trim().isEmpty()) return;

        int n = Integer.parseInt(line.trim());
        line = reader.readLine();
        if (line == null) return;
        String[] parts = line.trim().split("\\\\s+");
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) {
            nums[i] = Integer.parseInt(parts[i]);
        }

        line = reader.readLine();
        if (line == null) return;
        int target = Integer.parseInt(line.trim());

        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < n; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println(map.get(complement) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
    }
}
`,
};
