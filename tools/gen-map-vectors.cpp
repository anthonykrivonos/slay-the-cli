// Dumps reference map generations for golden tests.
// Build & run:
//   clang++ -std=c++17 -I references/sts_lightspeed/include tools/gen-map-vectors.cpp references/sts_lightspeed/src/game/Map.cpp -o /tmp/genmap && /tmp/genmap
#include <cstdio>
#include <cstdint>
#include "game/Map.h"

using namespace sts;

int main() {
    std::uint64_t seeds[] = {1ULL, 42ULL, 999ULL, 123456789ULL, 3939281923ULL, 18446744073709551615ULL};
    for (auto seed : seeds) {
        for (int act = 1; act <= 3; ++act) {
            for (int asc = 0; asc <= 1; ++asc) {
                Map map = Map::fromSeed(seed, asc, act, true);
                printf("# %llu %d %d %d %d %d\n", (unsigned long long)seed, act, asc,
                       map.burningEliteX, map.burningEliteY, map.burningEliteBuff);
                for (int y = 0; y < 15; y++) {
                    for (int x = 0; x < 7; x++) {
                        auto &n = map.getNode(x, y);
                        if (n.edgeCount > 0) {
                            printf("%d,%d,%c,", y, x, n.getRoomSymbol());
                            for (int i = 0; i < n.edgeCount; i++) printf("%d", n.edges[i]);
                            printf("\n");
                        }
                    }
                }
            }
        }
    }
    return 0;
}
