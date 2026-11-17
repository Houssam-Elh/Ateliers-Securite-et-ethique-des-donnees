// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MiniSocial {
    // 1. Structure représentant un message
    struct Post {
        string message;
        address author;
    }

    // 2. Tableau dynamique pour stocker tous les posts
    Post[] public posts;

    // Événement émis lors de la publication d'un message (bonne pratique)
    event PostCreated(uint indexed id, address indexed author, string message);

    // 3. Fonction pour publier un message
    function publishPost(string memory _message) public {
        require(bytes(_message).length > 0, "Le message ne peut pas etre vide");
        
        posts.push(Post({
            message: _message,
            author: msg.sender
        }));

        emit PostCreated(posts.length - 1, msg.sender, _message);
    }

    // 4. Fonction pour consulter un post par son index
    function getPost(uint index) public view returns (string memory, address) {
        require(index < posts.length, "Index invalide");
        Post memory p = posts[index];
        return (p.message, p.author);
    }

    // 5. Fonction pour récupérer le nombre total de messages publiés
    function getTotalPosts() public view returns (uint) {
        return posts.length;
    }
}