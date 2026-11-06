// ============================================================================
// This file simulates exclusively the "Attack Simulation" section:
//   1. 51% Attack and chain reorganization (PoW / PoS)
//   2. Double Spending attack
//   3. Selfish Mining with block publication strategy
//   4. Block Withholding inside a mining pool
//   5. Sybil Attack in a simulated P2P network
// ============================================================================


#include <iostream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cstdint>
#include <random>
#include <algorithm>

using namespace std;

// ----------------------------------------------------------------------------
// Cryptographic Utilities (simplified & fast hash for simulation purposes)
// ----------------------------------------------------------------------------

static string simpleHash(const string& data) {
    uint64_t hash = 1469598103934665603ULL;
    for (unsigned char c : data) {
        hash ^= c;
        hash *= 1099511628211ULL;
    }
    hash ^= hash >> 33;
    hash *= 0xff51afd7ed558ccdULL;
    hash ^= hash >> 33;

    ostringstream oss;
    oss << hex << setfill('0') << setw(16) << hash;
    return oss.str().substr(0, 12); // 12-character hexadecimal fingerprint
}

// ----------------------------------------------------------------------------
// Core Blockchain Data Structures
// ----------------------------------------------------------------------------

struct Block {
    int index = 0;
    string previousHash = "000000000000";
    string creator;
    vector<string> transactions;
    long long nonce = 0;
    string hash;

    string computeHash() const {
        ostringstream oss;
        oss << index << "|" << previousHash << "|" << creator << "|" << nonce << "|";
        for (const auto& tx : transactions) {
            oss << tx << ";";
        }
        return simpleHash(oss.str());
    }
};

struct Blockchain {
    vector<Block> chain;

    int height() const { return (int)chain.size(); }
    string lastHash() const {
        return chain.empty() ? "000000000000" : chain.back().hash;
    }

    bool isValid() const {
        string prev = "000000000000";
        for (size_t i = 0; i < chain.size(); ++i) {
            const Block& b = chain[i];
            if (b.index != (int)i || b.previousHash != prev) return false;
            if (b.computeHash() != b.hash) return false;
            prev = b.hash;
        }
        return true;
    }

    bool containsTransaction(const string& tx) const {
        for (const auto& b : chain) {
            for (const auto& t : b.transactions) {
                if (t == tx) return true;
            }
        }
        return false;
    }
};

// Mine (forge) a new block onto a blockchain using Proof of Work
static Block mineBlock(const Blockchain& bc, const vector<string>& txs,
                       const string& author, int difficulty = 2) {
    Block b;
    b.index       = bc.height();
    b.previousHash = bc.lastHash();
    b.transactions = txs;
    b.creator     = author;
    b.nonce       = 0;
    b.hash        = b.computeHash();

    string prefix(difficulty, '0');
    while (b.hash.substr(0, difficulty) != prefix) {
        b.nonce++;
        b.hash = b.computeHash();
    }
    return b;
}

static void printHeader(const string& code, const string& title) {
    cout << "\n======================================================================\n";
    cout << " [" << code << "] " << title << "\n";
    cout << "======================================================================\n";
}

// ============================================================================
// ATTACK 1 : 51% Attack & Chain Reorganization
// ============================================================================

void simulate51Attack() {
    printHeader("ATTACK 1", "51% Attack and Chain Reorganization");
    cout << "Principle: An attacker controlling more than 50% of the mining power\n"
         << "mines a secret parallel branch, then broadcasts it to force the network\n"
         << "to abandon the honest public chain (longest-chain rule).\n\n";

    Blockchain sharedChain;
    sharedChain.chain.push_back(mineBlock(sharedChain, {"Genesis"}, "System", 1));
    sharedChain.chain.push_back(mineBlock(sharedChain, {"Tx: Alice -> Bob : 10 BTC"}, "HonestMiner", 1));

    cout << "[Setup] Honest chain height = " << sharedChain.height() << "\n";

    // Hashrate percentages to test
    vector<int> testHashrates = {30, 49, 51, 65};
    int rounds = 60;

    cout << left << setw(16) << "Atk Hashrate"
         << setw(18) << "Honest Blocks"
         << setw(18) << "Attacker Blocks"
         << setw(20) << "Outcome" << "\n";
    cout << string(72, '-') << "\n";

    for (int hashrate : testHashrates) {
        Blockchain publicChain  = sharedChain;
        Blockchain attackChain  = sharedChain;

        int honestBlocks   = 0;
        int attackerBlocks = 0;

        for (int r = 1; r <= rounds; ++r) {
            // Deterministic winner selection based on hashrate share
            int chance = (r * 37) % 100;
            if (chance < hashrate) {
                attackChain.chain.push_back(
                    mineBlock(attackChain, {"Secret_Tx #" + to_string(r)}, "Attacker_51%", 1)
                );
                attackerBlocks++;
            } else {
                publicChain.chain.push_back(
                    mineBlock(publicChain, {"Public_Tx #" + to_string(r)}, "HonestMiners", 1)
                );
                honestBlocks++;
            }
        }

        bool reorg = attackChain.height() > publicChain.height();
        cout << left << setw(16) << (to_string(hashrate) + " %")
             << setw(18) << publicChain.height()
             << setw(18) << attackChain.height()
             << setw(20) << (reorg ? "REORG (Attacker wins)" : "Failed (Public chain)")
             << "\n";
    }

    cout << "\n-> Conclusion: Once hashrate exceeds 50%, the secret branch mathematically\n"
         << "   overtakes the public chain, erasing all honest blocks in the process.\n";
}

// ============================================================================
// ATTACK 2 : Double Spending
// ============================================================================

void simulateDoubleSpending() {
    printHeader("ATTACK 2", "Double Spending");
    cout << "Principle: The attacker pays a merchant on the public chain,\n"
         << "receives the goods, then broadcasts a private branch where those\n"
         << "same funds were sent back to their own wallet instead.\n\n";

    Blockchain publicChain;
    publicChain.chain.push_back(mineBlock(publicChain, {"Genesis"}, "System", 1));
    publicChain.chain.push_back(mineBlock(publicChain, {"Attacker balance: 50 BTC"}, "System", 1));

    Blockchain secretChain = publicChain; // Attacker forks from this point

    string txMerchant    = "Attacker -> Merchant: 50 BTC (Goods shipped)";
    string txDoubleSpend = "Attacker -> Attacker_Wallet: 50 BTC (Theft)";

    // Step 1: Legitimate payment mined on the public chain
    publicChain.chain.push_back(mineBlock(publicChain, {txMerchant}, "HonestMiner", 1));
    cout << "1. Merchant sees payment mined at block #" << publicChain.height() - 1
         << ": \"" << txMerchant << "\"\n";
    cout << "   -> Merchant validates the sale and ships the product to the attacker.\n\n";

    // Step 2: Attacker secretly mines with 60% of the power
    secretChain.chain.push_back(mineBlock(secretChain, {txDoubleSpend}, "Attacker", 1));
    for (int i = 0; i < 3; ++i) {
        secretChain.chain.push_back(mineBlock(secretChain, {"Private_Tx #" + to_string(i)}, "Attacker", 1));
    }
    // Honest miners add just one more block
    publicChain.chain.push_back(mineBlock(publicChain, {"Misc_Txs"}, "HonestMiner", 1));

    cout << "2. State before reveal:\n";
    cout << "   - Public chain height : " << publicChain.height()  << "\n";
    cout << "   - Secret chain height : " << secretChain.height()  << "\n\n";

    // Step 3: Attacker broadcasts the longer private chain
    cout << "3. Attacker broadcasts private chain to the P2P network...\n";
    if (secretChain.height() > publicChain.height() && secretChain.isValid()) {
        publicChain = secretChain; // Network reorganizes
        cout << "   -> Network performs a REORG and adopts the attacker's chain!\n";
    }

    cout << "\nFinal state of the adopted blockchain:\n";
    cout << "   - Final height                      : " << publicChain.height() << "\n";
    cout << "   - Merchant payment still present    : "
         << (publicChain.containsTransaction(txMerchant)    ? "YES" : "NO (ERASED)") << "\n";
    cout << "   - Funds recovered by attacker       : "
         << (publicChain.containsTransaction(txDoubleSpend) ? "YES (SUCCESS)" : "NO") << "\n";
    cout << "   -> Conclusion: The merchant lost the goods; the same coins were spent twice.\n";
}

// ============================================================================
// ATTACK 3 : Selfish Mining
// ============================================================================

void simulateSelfishMining() {
    printHeader("ATTACK 3", "Selfish Mining (Eyal & Sirer Strategy)");
    cout << "Principle: A malicious miner deliberately withholds discovered blocks\n"
         << "instead of broadcasting them immediately. By managing their lead carefully,\n"
         << "they force honest miners to waste computing power on orphaned (invalid) blocks.\n\n";

    const int selfishHashrate = 35; // 35% power (less than 50%!)
    const int totalRounds     = 100;

    int blocksFoundSelfish  = 0;
    int blocksFoundHonest   = 0;
    int orphanedBlocks      = 0;
    int finalBlocksSelfish  = 0;
    int finalBlocksHonest   = 0;

    int privateAdvantage = 0; // Number of secret blocks held in reserve

    mt19937 rng(42); // Fixed seed for reproducibility
    uniform_int_distribution<int> dist(0, 99);

    for (int round = 1; round <= totalRounds; ++round) {
        bool selfishFinds = (dist(rng) < selfishHashrate);

        if (selfishFinds) {
            blocksFoundSelfish++;
            privateAdvantage++;
            // Selfish miner keeps the block secret while holding an advantage
        } else {
            blocksFoundHonest++;
            if (privateAdvantage == 0) {
                // No lead: honest block is accepted
                finalBlocksHonest++;
            } else if (privateAdvantage == 1) {
                // Race: selfish miner publishes immediately to compete
                // On tie, assume selfish wins 50% of the time
                if (dist(rng) < 50) {
                    finalBlocksSelfish++;
                    orphanedBlocks++; // Honest block becomes an orphan
                } else {
                    finalBlocksHonest++;
                    orphanedBlocks++; // Selfish block is lost
                }
                privateAdvantage = 0;
            } else if (privateAdvantage == 2) {
                // Selfish publishes both blocks; honest block is invalidated
                finalBlocksSelfish += 2;
                orphanedBlocks++;
                privateAdvantage = 0;
            } else {
                // Lead > 2: publish 1 block to maintain the advantage
                finalBlocksSelfish++;
                orphanedBlocks++;
                privateAdvantage--;
            }
        }
    }

    // Publish any remaining withheld blocks
    finalBlocksSelfish += privateAdvantage;

    int totalValidBlocks    = finalBlocksSelfish + finalBlocksHonest;
    double rewardShare      = (100.0 * finalBlocksSelfish) / (totalValidBlocks > 0 ? totalValidBlocks : 1);

    cout << "Simulation parameters:\n";
    cout << "   - Attacker's nominal hashrate : " << selfishHashrate << " %\n";
    cout << "   - Total rounds simulated      : " << totalRounds << "\n\n";

    cout << "Simulation results:\n";
    cout << "   - Total blocks generated        : " << (blocksFoundSelfish + blocksFoundHonest) << "\n";
    cout << "   - Orphaned blocks (wasted work) : " << orphanedBlocks << "\n";
    cout << "   - Blocks in the final chain     : " << totalValidBlocks << "\n";
    cout << "     * Selfish miner's share       : " << finalBlocksSelfish << " blocks ("
         << fixed << setprecision(2) << rewardShare << " %)\n";
    cout << "     * Honest miners' share        : " << finalBlocksHonest << " blocks ("
         << fixed << setprecision(2) << (100.0 - rewardShare) << " %)\n";

    cout << "\n-> Conclusion: With only " << selfishHashrate << "% hashrate, the attacker earns "
         << fixed << setprecision(2) << rewardShare << "% of network rewards,\n"
         << "   exceeding their fair share by invalidating honest miners' work.\n";
}

// ============================================================================
// ATTACK 4 : Block Withholding Attack (Mining Pool Sabotage)
// ============================================================================

struct PoolMember {
    string name;
    int power; // in %
    bool isAttacker;
};

void simulateBlockWithholding() {
    printHeader("ATTACK 4", "Block Withholding Attack (Mining Pool Sabotage)");
    cout << "Principle: A malicious miner joins a mining pool. They submit 'shares'\n"
         << "(partial proofs of work) to collect their payout, but whenever they find\n"
         << "a REAL full block solving the puzzle, they discard it without submitting.\n\n";

    vector<PoolMember> members = {
        {"Miner_A",          40, false},
        {"Miner_B",          35, false},
        {"Infiltrated_Attacker", 25, true}
    };

    const int nbRounds           = 80;
    const int rewardPerBlock     = 50; // tokens per valid block

    cout << "Mining pool composition:\n";
    for (const auto& m : members) {
        cout << "   - " << setw(24) << left << m.name
             << " : " << m.power << "% hashrate "
             << (m.isAttacker ? "[MALICIOUS - Withholding]" : "[Honest]") << "\n";
    }
    cout << "\n";

    // Scenario 1: Honest pool (no attack)
    int validBlocksNormal = 0;
    for (int t = 0; t < nbRounds; ++t) {
        validBlocksNormal++; // Every found block is published
    }
    long long revenueNormal = (long long)validBlocksNormal * rewardPerBlock;

    // Scenario 2: Sabotage via Block Withholding
    int validBlocksAttack = 0;
    int destroyedBlocks   = 0;
    int sharesAttacker    = 0;
    int sharesHonest      = 0;

    mt19937 rng(123);
    uniform_int_distribution<int> dist(0, 99);

    for (int t = 0; t < nbRounds; ++t) {
        int r = dist(rng);
        if (r < 25) {
            // Attacker finds the block but discards it (withhold)!
            destroyedBlocks++;
            sharesAttacker++; // Still submits a share to get paid
        } else {
            // Honest miners find and publish
            validBlocksAttack++;
            sharesHonest++;
        }
    }

    long long revenueAttack = (long long)validBlocksAttack * rewardPerBlock;
    double revenueDrop      = 100.0 * (revenueNormal - revenueAttack) / revenueNormal;

    cout << "Scenario comparison (over " << nbRounds << " opportunities):\n";
    cout << "   [Scenario 1: Honest Pool]\n";
    cout << "      - Valid blocks published : " << validBlocksNormal << "\n";
    cout << "      - Total revenue generated: " << revenueNormal << " tokens\n";
    cout << "   [Scenario 2: Pool with Saboteur]\n";
    cout << "      - Valid blocks published : " << validBlocksAttack << "\n";
    cout << "      - Blocks sabotaged/lost  : " << destroyedBlocks << "\n";
    cout << "      - Total revenue generated: " << revenueAttack << " tokens\n";
    cout << "      - Pool revenue drop      : -" << fixed << setprecision(2) << revenueDrop << " %\n";

    cout << "\n-> Conclusion: The attacker drains the pool's earnings through shares\n"
         << "   while never contributing a real block, ruining the pool operator.\n";
}

// ============================================================================
// ATTACK 5 : Sybil Attack in a P2P Network
// ============================================================================

struct P2PNode {
    string id;
    bool isSybil;
    int connections;
};

void simulateSybilAttack() {
    printHeader("ATTACK 5", "Sybil Attack in a Simulated P2P Network");
    cout << "Principle: An attacker creates massive numbers of fake identities (Sybil nodes)\n"
         << "at near-zero cost in order to surround (Eclipse attack) honest nodes, censor\n"
         << "their transactions, or corrupt votes in a consensus not backed by a scarce resource.\n\n";

    int honestNodes = 10;
    int sybilNodes  = 40; // Attacker injects 40 fake nodes

    cout << "P2P network configuration:\n";
    cout << "   - Legitimate nodes (honest) : " << honestNodes << "\n";
    cout << "   - Sybil nodes (by attacker) : " << sybilNodes  << "\n";
    cout << "   - Total network identities  : " << (honestNodes + sybilNodes) << "\n\n";

    // Simulate the peer connections of an honest victim node (Bob)
    // Bob randomly connects to 8 peers from the P2P routing table
    const int maxBobPeers  = 8;
    int sybilBobPeers      = 0;
    int honestBobPeers     = 0;

    mt19937 rng(999);
    int totalNodes = honestNodes + sybilNodes;

    for (int i = 0; i < maxBobPeers; ++i) {
        int choice = rng() % totalNodes;
        if (choice < sybilNodes) {
            sybilBobPeers++;
        } else {
            honestBobPeers++;
        }
    }

    double controlPct = (100.0 * sybilBobPeers) / maxBobPeers;

    cout << "Analysis of victim node 'Bob's connections (8 peers max):\n";
    cout << "   - Honest peers connected    : " << honestBobPeers << "\n";
    cout << "   - Sybil peers connected     : " << sybilBobPeers  << "\n";
    cout << "   - Encirclement rate         : " << fixed << setprecision(1) << controlPct << " %\n";

    if (sybilBobPeers >= 6) {
        cout << "   -> STATUS: ECLIPSE SUCCESSFUL! Attacker controls most of Bob's traffic.\n"
             << "      Bob will no longer receive real blocks; transactions can be censored.\n";
    } else {
        cout << "   -> STATUS: Partial eclipse. Bob still has links to the honest network.\n";
    }

    cout << "\n-> Why PoW/PoS blockchains resist Sybil attacks:\n"
         << "   In PoW/PoS, decision power does NOT depend on the NUMBER of nodes (IPs),\n"
         << "   but on a costly and verifiable resource: computing power (PoW)\n"
         << "   or locked stake (PoS). Creating 1000 nodes without hashrate/stake grants no power.\n";
}

// ============================================================================
// Main Entry Point
// ============================================================================

int main() {
    cout << "######################################################################\n";
    cout << "#    WORKSHOP 2 : BLOCKCHAIN ATTACK SIMULATION                      #\n";
    cout << "#    Section Completed : 1. Attack Implementation                   #\n";
    cout << "######################################################################\n";

    // 1. 51% Attack & Chain Reorganization
    simulate51Attack();

    // 2. Double Spending
    simulateDoubleSpending();

    // 3. Selfish Mining
    simulateSelfishMining();

    // 4. Block Withholding in a Mining Pool
    simulateBlockWithholding();

    // 5. Sybil Attack in a P2P Network
    simulateSybilAttack();

    cout << "\n======================================================================\n";
    cout << " [END] All attacks from the assignment have been simulated.\n";
    cout << "======================================================================\n";

    return 0;
}
