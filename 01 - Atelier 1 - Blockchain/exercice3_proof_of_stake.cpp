#include <iostream>
#include <string>
#include <vector>
#include <random>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <cstdint>

using namespace std;

string hashTexte(const string& texte) { // Function to hash a string
    uint64_t hash = 14695981039346656037ULL;

    for (unsigned char c : texte) {
        hash ^= c;
        hash *= 1099511628211ULL;
    }

    stringstream sortie;
    sortie << hex << setfill('0') << setw(16) << hash;

    return sortie.str();
}

struct Validateur { // Structure representing a validator in the Proof of Stake system
    string nom;
    int mise;
};

int choisirPoS(const vector<Validateur>& validateurs) { // Function to select a validator using the Proof of Stake mechanism
    int total = 0;

    for (const auto& v : validateurs) { // Calculate the total stake of all validators
        total += v.mise;
    }

    random_device rd; 
    mt19937 generateur(rd());

    uniform_int_distribution<int> tirage(1, total);

    int numero = tirage(generateur);
    int cumul = 0;

    for (size_t i = 0; i < validateurs.size(); i++) { // Iterate through validators to find the one matching the drawn number
        cumul += validateurs[i].mise;

        if (numero <= cumul) {
            return static_cast<int>(i);
        }
    }

    return 0;
}

int main() {
    vector<Validateur> validateurs = {
        {"Alice", 60},
        {"Bob", 30},
        {"Carla", 10}
    };

    cout << "=== Comparaison PoS et PoW ===\n";

    auto debutPoS = chrono::steady_clock::now();

    int gagnant = choisirPoS(validateurs);

    auto finPoS = chrono::steady_clock::now();

    double tempsPoS = chrono::duration<double, micro>(
        finPoS - debutPoS
    ).count();

    cout << "Validateur choisi : "
         << validateurs[gagnant].nom << endl;

    cout << "Temps PoS : "
         << tempsPoS << " microsecondes\n";

    auto debutPoW = chrono::steady_clock::now();

    uint64_t nonce = 0;
    string hash;
    int difficulte = 3;

    do {
        hash = hashTexte(
            "bloc-demo" + to_string(nonce)
        );

        if (hash.substr(0, difficulte) == "000") {
            break;
        }

        nonce++;

    } while (true);

    auto finPoW = chrono::steady_clock::now();

    double tempsPoW = chrono::duration<double, micro>(
        finPoW - debutPoW
    ).count();

    cout << "Nonce PoW : " << nonce << endl;
    cout << "Hash PoW : " << hash << endl;

    cout << "Temps PoW : "
         << tempsPoW << " microsecondes\n";

    if (tempsPoS < tempsPoW) {
        cout << "PoS est plus rapide dans ce test.\n";
    } else {
        cout << "PoW est plus rapide dans ce test.\n";
    }

    return 0;
}
