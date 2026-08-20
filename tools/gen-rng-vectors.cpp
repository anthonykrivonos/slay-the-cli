// Generates ground-truth RNG vectors from sts_lightspeed's Random.h for the
// engine test suite. Build & run:
//   clang++ -std=c++17 -I references/sts_lightspeed/include tools/gen-rng-vectors.cpp -o /tmp/genrng && /tmp/genrng
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
#include "game/Random.h"

using sts::Random;

int main() {
    printf("{\n");

    // sequences of random(99) for a few seeds
    printf("  \"random99\": {\n");
    std::uint64_t seeds[] = {1ULL, 42ULL, 123456789ULL, 0ULL, 18446744073709551615ULL};
    for (int s = 0; s < 5; s++) {
        Random r(seeds[s]);
        printf("    \"%llu\": [", (unsigned long long)seeds[s]);
        for (int i = 0; i < 20; i++) printf("%s%d", i ? "," : "", r.random(99));
        printf("]%s\n", s < 4 ? "," : "");
    }
    printf("  },\n");

    // randomRange
    {
        Random r(777ULL);
        printf("  \"randomRange_777_10_20\": [");
        for (int i = 0; i < 20; i++) printf("%s%d", i ? "," : "", r.random(10, 20));
        printf("],\n");
    }

    // floats (printed with enough precision to round-trip float32)
    {
        Random r(2022ULL);
        printf("  \"randomFloat_2022\": [");
        for (int i = 0; i < 20; i++) printf("%s%.9g", i ? "," : "", r.random());
        printf("],\n");
    }
    {
        Random r(2022ULL);
        printf("  \"randomFloatRange_2022_0p9_1p1\": [");
        for (int i = 0; i < 20; i++) printf("%s%.9g", i ? "," : "", r.random(0.9f, 1.1f));
        printf("],\n");
    }

    // booleans with chance
    {
        Random r(555ULL);
        printf("  \"randomBoolean_555_0p4\": [");
        for (int i = 0; i < 30; i++) printf("%s%d", i ? "," : "", r.randomBoolean(0.4f) ? 1 : 0);
        printf("],\n");
    }

    // counter fast-forward equivalence target
    {
        Random r(9999ULL);
        for (int i = 0; i < 137; i++) r.random(999);
        printf("  \"counterFF_9999_137_next\": %d,\n", r.random(99));
    }

    // randomLong bounded
    {
        Random r(31337ULL);
        printf("  \"randomLong_31337_1000000\": [");
        for (int i = 0; i < 10; i++) printf("%s%lld", i ? "," : "", (long long)r.random((std::int64_t)1000000));
        printf("],\n");
    }

    // java.Random + shuffle
    {
        java::Random jr(123456789ULL);
        printf("  \"javaNextInt_123456789_60\": [");
        for (int i = 0; i < 20; i++) printf("%s%d", i ? "," : "", jr.nextInt(60));
        printf("],\n");
    }
    {
        std::vector<int> v;
        for (int i = 0; i < 20; i++) v.push_back(i);
        java::Collections::shuffle(v.begin(), v.end(), java::Random(42ULL));
        printf("  \"javaShuffle_42_20\": [");
        for (int i = 0; i < 20; i++) printf("%s%d", i ? "," : "", v[i]);
        printf("]\n");
    }

    printf("}\n");
    return 0;
}
