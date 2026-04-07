# ABOUTME: One-time script to generate the Tauri updater signing keypair.
# ABOUTME: Run once before the first production build. Store the private key in a vault — never commit it.

#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "  N.I.K.O. Updater Keypair Generator  "
echo "=========================================="
echo ""

# Check that Tauri CLI is available
if ! cargo tauri --version &>/dev/null; then
  echo "ERROR: Tauri CLI is not available via cargo."
  echo ""
  echo "Install it with:"
  echo "  cargo install tauri-cli"
  echo ""
  echo "Or if you use the npm wrapper:"
  echo "  npm install -g @tauri-apps/cli"
  echo "  and use 'tauri signer generate' instead of 'cargo tauri signer generate'"
  exit 1
fi

# Prevent accidental re-runs if key already exists
if [[ -f "updater.key" ]]; then
  echo "WARNING: updater.key already exists in the current directory."
  echo "If you regenerate the key, existing installed versions of NIKO"
  echo "will no longer be able to receive updates signed with this new key."
  echo ""
  read -r -p "Are you absolutely sure you want to overwrite it? [y/N] " confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
    echo "Aborted. No keys were modified."
    exit 0
  fi
fi

echo "Generating keypair..."
echo ""

# Generate the keypair. This writes updater.key (private) and updater.key.pub (public).
cargo tauri signer generate -w updater.key

echo ""
echo "=========================================="
echo "  PUBLIC KEY (safe to commit)             "
echo "=========================================="
echo ""
cat updater.key.pub
echo ""
echo "=========================================="
echo ""
echo "NEXT STEPS — READ CAREFULLY:"
echo ""
echo "1. COPY the public key above and paste it into:"
echo "   src-tauri/tauri.conf.json → plugins.updater.pubkey"
echo "   Replace the placeholder string 'REPLACE_WITH_PUBLIC_KEY_FROM_KEYGEN_SCRIPT'"
echo ""
echo "2. STORE THE PRIVATE KEY (updater.key) in your secrets vault NOW:"
echo "   - Password manager entry name: 'NIKO Tauri Updater Private Key'"
echo "   - Store the full file contents as a secure note"
echo "   - If you used a password during generation, store that too"
echo ""
echo "3. ADD THE PRIVATE KEY AS A GITHUB ACTIONS SECRET:"
echo "   - Secret name:     TAURI_SIGNING_PRIVATE_KEY"
echo "     Value: contents of updater.key (the entire file, including header/footer)"
echo "   - Secret name:     TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
echo "     Value: the passphrase you used, or leave empty if no passphrase"
echo ""
echo "4. DELETE THE LOCAL PRIVATE KEY FILE after storing it safely:"
echo "   rm updater.key"
echo ""
echo "   The public key file (updater.key.pub) is safe to keep locally."
echo ""
echo "WARNING: If this private key is lost, existing installed versions of"
echo "         NIKO cannot receive future updates. There is NO recovery path."
echo "         You would need to distribute a new installer manually to all users."
echo ""

# Add updater.key to .gitignore to prevent accidental commits
GITIGNORE_PATH="$(git rev-parse --show-toplevel 2>/dev/null)/.gitignore"
if [[ -f "${GITIGNORE_PATH}" ]]; then
  if ! grep -q "updater.key" "${GITIGNORE_PATH}"; then
    echo "" >> "${GITIGNORE_PATH}"
    echo "# Tauri updater signing private key — never commit" >> "${GITIGNORE_PATH}"
    echo "updater.key" >> "${GITIGNORE_PATH}"
    echo "(Added updater.key to .gitignore)"
  else
    echo "(updater.key is already in .gitignore — good)"
  fi
else
  echo "WARNING: Could not locate .gitignore. Manually ensure updater.key is excluded from git."
fi

echo ""
echo "Done. Remember: store the private key in vault before closing this terminal."
