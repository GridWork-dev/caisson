"""Caisson Discord AI support bot.

A custom, self-built support service (ADR-0009): a discord.py front-end over a codebase-grounded RAG
pipeline (retrieval via the ``services/docs`` ``POST /query`` contract, generation via OpenRouter).
Answers only from the documented codebase; on an unresolved question it drafts an AI brief, opens a
thread tagging a human, and persists a ``support_ticket`` row. Implementation locks: ADR-0105.
"""

__version__ = "0.1.0"
