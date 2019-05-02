#!/bin/bash

outDir=$1

node export-tree.js PasswordlessWebAuthn "$outDir"
node export-tree.js SecondFactor "$outDir"
node export-tree.js SecondFactorCustom "$outDir"
node export-tree.js SecondFactorWebAuthn "$outDir"
node export-tree.js UsernamePassword "$outDir"