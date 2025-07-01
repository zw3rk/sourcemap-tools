#!/bin/bash

# Create test directory structure
mkdir -p examples/uwu

# Copy test files to expected locations
cp nested_test.uwu examples/uwu/nested_test.uwu
cp nested_test.uplc examples/uwu/nested_test.uplc

# Create a corrected source map that references the right paths
cat > examples/uwu/nested_test.uplc.map << 'EOF'
{
  "version": 3,
  "file": "nested_test.uplc",
  "sourceRoot": "",
  "sources": ["nested_test.uwu"],
  "sourcesContent": null,
  "names": ["APP", "INTEGER", "LAM", "PGM", "VER", "addInteger", "x", "y", "z"],
  "mappings": "AAAAG,SAAAC;EAICJ,CAAAA,CAAAA,EAAAE,I,AAACI,C,EACCJ,I,AAACK,C,EACCL,I,AAACM,C,CACCR,CAAAA,CAAAK,oBACCL,CAACA,CAAAA,CAAAK,oBAAUL,CAACM,CAADN,CAAEA,CAACO,CAADP,CAAbA,CACDA,CAACQ,CAADR,CAHDE,CADFA,CADFA,CAMDF,CAACC,eAADD,CACAA,CAACC,gBAADD,CACAA,CAACC,gBAADD;AAZDG"
}
EOF

echo "Test files setup complete!"
echo "You can now test the extension with: examples/uwu/nested_test.uplc.map"