# Contributing to Source Map Visualizer

Thank you for your interest in contributing to Source Map Visualizer! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Issues

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - VSCode version and OS
   - Sample files if applicable

### Suggesting Features

1. Check existing feature requests
2. Open a discussion first for major features
3. Provide use cases and examples
4. Consider implementation complexity

### Submitting Pull Requests

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/sourcemap-tools
   cd sourcemap-tools
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Setup Development Environment**
   ```bash
   make init
   make dev
   ```

4. **Make Changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

5. **Test Your Changes**
   ```bash
   make test
   make lint
   ```

6. **Commit Changes**
   - Use clear commit messages
   - Reference issues: "Fix #123: Description"
   - Keep commits focused

7. **Push and Create PR**
   - Push to your fork
   - Create PR against `main` branch
   - Fill out PR template
   - Link related issues

## Development Guidelines

### Code Style

- TypeScript strict mode enabled
- Use ESLint and Prettier configurations
- Follow functional programming patterns where appropriate
- Avoid global state
- Write self-documenting code with minimal comments

### Testing

- Write tests for new features
- Maintain or improve code coverage
- Test edge cases
- Use meaningful test descriptions

### Documentation

- Update README for user-facing changes
- Update API docs for code changes
- Add JSDoc comments for public APIs
- Include examples where helpful

## Project Structure

```
├── src/              # Extension source code
│   ├── extension.ts  # Entry point
│   ├── viewer/       # Map viewer implementation
│   └── editor/       # Desc editor implementation
├── webview/          # Frontend code
│   ├── viewer/       # Viewer UI components
│   └── editor/       # Editor UI components
├── test/             # Test files
└── docs/             # Documentation
```

## Development Workflow

1. **Setup Environment**
   ```bash
   # Using Nix (recommended)
   nix develop
   
   # Or standard Node.js
   npm install
   ```

2. **Start Development**
   ```bash
   make dev
   # Press F5 in VSCode to launch extension
   ```

3. **Available Commands**
   ```bash
   make help     # Show all commands
   make build    # Build extension
   make test     # Run tests
   make lint     # Check code style
   make format   # Auto-format code
   make package  # Create .vsix package
   ```

## Pull Request Process

1. **Before Submitting**
   - [ ] Tests pass (`make test`)
   - [ ] Linting passes (`make lint`)
   - [ ] Documentation updated
   - [ ] CHANGELOG.md updated
   - [ ] Commits are clean and focused

2. **PR Review Process**
   - Maintainers will review within 3-5 days
   - Address feedback promptly
   - Keep PR updated with main branch
   - Be patient and respectful

3. **After Merge**
   - Delete your feature branch
   - Pull latest main to your fork
   - Celebrate! 🎉

## Release Process

Releases are managed by maintainers:

1. Version bump in package.json
2. Update CHANGELOG.md
3. Create GitHub release
4. Automated publish to marketplace

## Getting Help

- Check existing documentation
- Search closed issues
- Ask in discussions
- Join our community chat (if available)

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes (for significant contributions)
- Project documentation

Thank you for contributing to Source Map Visualizer!