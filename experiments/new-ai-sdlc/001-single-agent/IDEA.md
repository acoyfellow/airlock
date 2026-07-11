# Held-out idea

A visitor should be able to inspect the Airlock + Keel launch proof in the browser instead
of trusting the page's summary.

Add a `/proof` route to the Airlock site. It must load the public launch-proof receipt,
verify the successful proof's Ed25519 signature and artifact binding locally, and show a
clear verified or refused result. A visitor can paste another receipt JSON and verify it
without sending it to a server. Malformed, tampered, unknown-schema, or untrusted-key
input must be refused without crashing.

Keep the mechanism narrow: this viewer verifies the fixed `airlock+keel/launch-proof@1`
receipt shape. It does not deploy, promote, fetch keys, or claim that the underlying checks
were semantically correct.
