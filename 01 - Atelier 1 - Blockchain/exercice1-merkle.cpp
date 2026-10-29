#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <cstdint>

using namespace std;

string hashTexte(const string& texte) {  // Function to hash a string
    uint64_t hash = 14695981039346656037ULL; 

    for (unsigned char c : texte) { // Iterate through each character of the string
        hash ^= c;
        hash *= 1099511628211ULL;
    }

    stringstream sortie;
    sortie << hex << setfill('0') << setw(16) << hash; // Convert the hash to a hexadecimal string

    return sortie.str();
}

string hashPair(const string& gauche, const string& droite) { // Function to hash a pair of strings
    return hashTexte(gauche + droite);
}

string racineMerkle(vector<string> transactions) { // Function to calculate the Merkle root from a list of transactions
    if (transactions.empty()) {
        return hashTexte("");
    }

    for (string& transaction : transactions) { // Hash each transaction individually
        transaction = hashTexte(transaction);
    }

    while (transactions.size() > 1) {
        vector<string> suivant;

        for (size_t i = 0; i < transactions.size(); i += 2) { // Process transactions in pairs
            string gauche = transactions[i]; 

            string droite;

            if (i + 1 < transactions.size()) {
                droite = transactions[i + 1];
            }
            else {
                droite = gauche;
            }

            suivant.push_back(hashPair(gauche, droite));
        }

        transactions = suivant;
    }

    return transactions[0];
}

int main() {
    vector<string> transactions = {
        "Houssam->Homam:23",
        "Homam->Bilal:18",
        "Bilal->Ayoub:12",
        "Ayoub->Houssam:9"
    };

    cout << "=== Arbre de Merkle ===\n";

    for (size_t i = 0; i < transactions.size(); i++) {
        cout << "Transaction " << i + 1 << " : " << transactions[i] << endl;

        cout << "Hash : " << hashTexte(transactions[i]) << endl;
    }

    string racine1 = racineMerkle(transactions);

    cout << "\nRacine Merkle : " << racine1 << endl;

    transactions[1] = "Homam->Bilal:100";

    string racine2 = racineMerkle(transactions);

    cout << "Racine apres modification : " << racine2 << endl;

    cout << "Racine modifiee ? " << (racine1 != racine2 ? "Oui" : "Non") << endl;

    return 0;
}