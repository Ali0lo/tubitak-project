"""Utilities for generating and hashing secure tokens."""

import hashlib
import secrets


class TokenUtils:
    """Helper methods for generating and hashing secure tokens."""

    @staticmethod
    def generate_secure_token(length: int = 48) -> str:
        """
        Generate a cryptographically secure URL-safe token.

        Args:
            length: Number of random bytes before URL-safe encoding.

        Returns:
            URL-safe random token.
        """
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_token(token: str) -> str:
        """
        Hash a token using SHA-256.

        Args:
            token: Plain-text token.

        Returns:
            Hex digest.
        """
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    def generate_token_pair(cls) -> tuple[str, str]:
        """
        Generate both the plain token and its SHA-256 hash.

        Returns:
            (plain_token, hashed_token)
        """
        token = cls.generate_secure_token()
        return token, cls.hash_token(token)

    @staticmethod
    def constant_time_compare(token_hash: str, expected_hash: str) -> bool:
        """
        Constant-time comparison to prevent timing attacks.
        """
        return secrets.compare_digest(token_hash, expected_hash)