{
  description = "VSCode Source Map Visualizer Extension";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        nodejs = pkgs.nodejs_20;
        
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            nodePackages.npm
            nodePackages.typescript
            nodePackages.typescript-language-server
            
            # VSCode extension development tools
            nodePackages.yo
            
            # Development utilities
            git
            gnumake
            ripgrep
            jq
            
            # For testing
            nodePackages.mocha
          ];

          shellHook = ''
            echo "Source Map Visualizer VSCode Extension Development Environment"
            echo "Node.js version: $(node --version)"
            echo "npm version: $(npm --version)"
            echo ""
            echo "Run 'make help' to see available commands"
            
            # Create node_modules symlink if it doesn't exist
            if [ ! -d "node_modules" ] && [ -f "package.json" ]; then
              echo "Installing npm dependencies..."
              npm install
            fi
          '';
        };
      });
}