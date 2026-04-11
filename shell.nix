{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_22
    nodePackages.pnpm
    biome
    nodePackages.typescript
    nodePackages.eslint
  ];
}
