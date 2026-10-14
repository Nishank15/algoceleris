use judge_core::Language;
use judge_worker::{
    AstTokenizer, Fingerprint, MatchedRange, PlagiarismDetector, Winnower, WorkerError,
};

#[test]
fn test_variable_renaming_immunity() -> Result<(), WorkerError> {
    let detector = PlagiarismDetector::new(8, 4);

    let code_a = r"
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
    return arr
";

    let code_b = r"
def sort_items(values):
    count = len(values)
    for step in range(count):
        for idx in range(0, count - step - 1):
            if values[idx] > values[idx + 1]:
                holder = values[idx]
                values[idx] = values[idx + 1]
                values[idx + 1] = holder
    return values
";

    let report = detector.compare(Language::Python, code_a, code_b)?;

    // Variable renaming must retain at least 85% structural similarity
    assert!(
        report.similarity >= 0.85,
        "expected >= 0.85 similarity, got {}",
        report.similarity
    );
    assert_ne!(
        report.matched_ranges,
        Vec::<MatchedRange>::new(),
        "matched ranges should not be empty"
    );

    Ok(())
}

#[test]
fn test_formatting_and_comment_immunity() -> Result<(), WorkerError> {
    let detector = PlagiarismDetector::new(8, 4);

    let code_clean = r"
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
";

    let code_commented = r"
# Binary search algorithm
# Finds target element in sorted array

def binary_search(arr, target):

    # Set up left boundary
    low = 0

    # Set up right boundary
    high = len(arr) - 1

    # Search loop
    while low <= high:

        mid = (low + high) // 2 # Compute midpoint

        if arr[mid] == target:
            return mid # Element found
        elif arr[mid] < target:
            low = mid + 1 # Search right partition
        else:
            high = mid - 1 # Search left partition

    # Element not found
    return -1
";

    let tokens_clean = AstTokenizer::tokenize(Language::Python, code_clean)?;
    let tokens_commented = AstTokenizer::tokenize(Language::Python, code_commented)?;

    let winnower = Winnower::new(8, 4);
    let fps_clean = winnower.fingerprints(&tokens_clean);
    let fps_commented = winnower.fingerprints(&tokens_commented);

    // Structural token sequences should match exactly in kinds and count
    assert_eq!(
        tokens_clean.len(),
        tokens_commented.len(),
        "structural token counts must match"
    );

    // Structural fingerprints must be 100% identical
    assert_eq!(
        fps_clean, fps_commented,
        "structural fingerprints must be 100% identical"
    );

    let report = detector.compare(Language::Python, code_clean, code_commented)?;
    assert!(
        (report.similarity - 1.0).abs() < f64::EPSILON,
        "expected 1.0 similarity, got {}",
        report.similarity
    );

    Ok(())
}

#[test]
fn test_distinct_solutions() -> Result<(), WorkerError> {
    let detector = PlagiarismDetector::new(8, 4);

    let binary_search = r"
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
";

    let sieve_primes = r"
def sieve_of_eratosthenes(limit):
    primes = []
    is_prime = [True] * (limit + 1)
    for p in range(2, limit + 1):
        if is_prime[p]:
            primes.append(p)
            for multiple in range(p * p, limit + 1, p):
                is_prime[multiple] = False
    return primes
";

    let report = detector.compare(Language::Python, binary_search, sieve_primes)?;

    // Two fundamentally different algorithms must have <= 25% similarity
    assert!(
        report.similarity <= 0.25,
        "expected <= 0.25 similarity, got {}",
        report.similarity
    );

    Ok(())
}

#[test]
fn test_cpp_structural_plagiarism() -> Result<(), WorkerError> {
    let detector = PlagiarismDetector::new(10, 5);

    let cpp_a = r"
int fibonacci(int n) {
    if (n <= 1) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; ++i) {
        int c = a + b;
        a = b;
        b = c;
    }
    return b;
}
";

    let cpp_b = r"
int compute_series(int term) {
    if (term <= 1) return term;
    int prev1 = 0, prev2 = 1;
    for (int step = 2; step <= term; ++step) {
        int sum = prev1 + prev2;
        prev1 = prev2;
        prev2 = sum;
    }
    return prev2;
}
";

    let report = detector.compare(Language::Cpp, cpp_a, cpp_b)?;
    assert!(
        report.similarity >= 0.85,
        "C++ renamed solution should have >= 0.85 similarity, got {}",
        report.similarity
    );
    assert_ne!(
        report.matched_ranges,
        Vec::<MatchedRange>::new(),
        "matched ranges should not be empty"
    );

    Ok(())
}

#[test]
fn test_java_structural_plagiarism() -> Result<(), WorkerError> {
    let detector = PlagiarismDetector::new(10, 5);

    let java_a = r"
public class Solver {
    public static int linearSearch(int[] data, int key) {
        for (int i = 0; i < data.length; i++) {
            if (data[i] == key) {
                return i;
            }
        }
        return -1;
    }
}
";

    let java_b = r"
public class Solution {
    public static int findTarget(int[] elements, int val) {
        for (int idx = 0; idx < elements.length; idx++) {
            if (elements[idx] == val) {
                return idx;
            }
        }
        return -1;
    }
}
";

    let report = detector.compare(Language::Java, java_a, java_b)?;
    assert!(
        report.similarity >= 0.85,
        "Java renamed solution should have >= 0.85 similarity, got {}",
        report.similarity
    );
    assert_ne!(
        report.matched_ranges,
        Vec::<MatchedRange>::new(),
        "matched ranges should not be empty"
    );

    Ok(())
}

#[test]
fn test_short_code_fallback() {
    let detector = PlagiarismDetector::new(20, 5);
    let fps_a = vec![Fingerprint::new(12345, 0)];
    let fps_b = vec![Fingerprint::new(12345, 0)];

    let similarity = PlagiarismDetector::jaccard_similarity(&fps_a, &fps_b);
    assert!((similarity - 1.0).abs() < f64::EPSILON);

    let ranges = detector.identify_matched_ranges(&fps_a, &fps_b);
    assert_eq!(ranges.len(), 1);

    let empty: Vec<Fingerprint> = Vec::new();
    assert!((PlagiarismDetector::jaccard_similarity(&empty, &empty) - 1.0).abs() < f64::EPSILON);
    assert!((PlagiarismDetector::jaccard_similarity(&fps_a, &empty) - 0.0).abs() < f64::EPSILON);
}
