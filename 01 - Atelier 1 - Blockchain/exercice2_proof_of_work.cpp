#include <iostream>
#include <string>
#include <sstream>
#include <iomanip>
#include <cstdint> 
#include <chrono> // To measure execution time

using namespace std;

string hashTexte(const string& texte) { // Function to hash a string
    uint64_t hash = 14695981039346656037ULL;

    for (unsigned char c : texte) { // Iterate through each character of the string
        hash ^= c;
        hash *= 1099511628211ULL;
    }

    stringstream sortie;
    sortie << hex << setfill('0') << setw(16) << hash;

    return sortie.str();
}

struct Bloc { // Structure representing a block in the blockchain
    int index;
    string donnees;
    string hashPrecedent;
    uint64_t nonce;
    string hash;

    string calculerHash() const { // Function to calculate the block hash
        return hashTexte(
            to_string(index) +
            donnees +
            hashPrecedent +
            to_string(nonce)
        );
    }

    void miner(int difficulte) { // Function to mine the block by finding a nonce that satisfies the difficulty target
        string cible(difficulte, '0');
        nonce = 0;

        while (true) { // Loop until a valid hash is found
            hash = calculerHash();

            if (hash.substr(0, difficulte) == cible) {
                break;
            }

            nonce++;
        }
    }
};

int main() {
    cout << "=== Proof of Work ===\n";

    for (int difficulte = 1; difficulte <= 4; difficulte++) {
        Bloc bloc{
            1,
            "Transaction Alice->Bob:10",
            "0000000000000000",
            0,
            ""
        };

        auto debut = chrono::steady_clock::now();

        bloc.miner(difficulte);

        auto fin = chrono::steady_clock::now();

        double temps = chrono::duration<double, milli>(
            fin - debut
        ).count();

        cout << "\nDifficulte : " << difficulte << endl;
        cout << "Nonce : " << bloc.nonce << endl;
        cout << "Hash : " << bloc.hash << endl;
        cout << "Temps : " << temps << " ms" << endl;
    }

    return 0;
}
