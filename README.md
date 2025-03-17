<!-- markdownlint-disable MD041 -->
<div align="center">
  <a href="https://coder.com#gh-light-mode-only">
    <img src="./docs/images/logo-black.png" alt="Coder Logo Light" style="width: 128px">
  </a>
  <a href="https://coder.com#gh-dark-mode-only">
    <img src="./docs/images/logo-white.png" alt="Coder Logo Dark" style="width: 128px">
  </a>

  <h1>
  Self-Hosted Cloud Development Environments
  </h1>

  <a href="https://coder.com#gh-light-mode-only">
    <img src="./docs/images/banner-black.png" alt="Coder Banner Light" style="width: 650px">
  </a>
  <a href="https://coder.com#gh-dark-mode-only">
    <img src="./docs/images/banner-white.png" alt="Coder Banner Dark" style="width: 650px">
  </a>

  <br>
  <br>

[Quickstart](#quickstart) | [Docs](https://coder.com/docs) | [Why Coder](https://coder.com/why) | [Premium](https://coder.com/pricing#compare-plans)

[![discord](https://img.shields.io/discord/747933592273027093?label=discord)](https://discord.gg/coder)
[![release](https://img.shields.io/github/v/release/coder/coder)](https://github.com/coder/coder/releases/latest)
[![godoc](https://pkg.go.dev/badge/github.com/coder/coder.svg)](https://pkg.go.dev/github.com/coder/coder)
[![Go Report Card](https://goreportcard.com/badge/github.com/coder/coder/v2)](https://goreportcard.com/report/github.com/coder/coder/v2)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9511/badge)](https://www.bestpractices.dev/projects/9511)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/coder/coder/badge)](https://scorecard.dev/viewer/?uri=github.com%2Fcoder%2Fcoder)
[![license](https://img.shields.io/github/license/coder/coder)](./LICENSE)

</div>

[Coder](https://coder.com) is a powerful platform that enables organizations to provision secure, consistent development environments in their public or private cloud infrastructure.

With Coder, development environments are:
- Defined as code using Terraform
- Connected through a secure high-speed Wireguard® tunnel
- Automatically shut down when not in use to optimize costs
- Accessible from anywhere with an internet connection

Coder empowers engineering teams with the flexibility to use the cloud for workloads that best suit their needs, while maintaining security and consistency across the organization.

- Define cloud development environments in Terraform
  - EC2 VMs, Kubernetes Pods, Docker Containers, etc.
- Automatically shutdown idle resources to save on costs
- Onboard developers in seconds instead of days

bananas

<p align="center">
  <img src="./docs/images/hero-image.png" alt="Coder Hero Image">
</p>

## Quickstart

The fastest way to get started with Coder is to install it on your local machine and provision development environments using Docker. This method works on Linux, macOS, and Windows.

### Step 1: Install Coder

```shell
curl -L https://coder.com/install.sh | sh
```

### Step 2: Start the Coder server

```shell
# Data is cached in ~/.cache/coder
coder server
```

### Step 3: Set up your first workspace

1. Navigate to http://localhost:3000
2. Create your initial admin user
3. Add a Docker template
4. Provision your first workspace

For more detailed instructions, visit our [Getting Started guide](https://coder.com/docs/getting-started).

## Install

The easiest way to install Coder is to use our
[install script](https://github.com/coder/coder/blob/main/install.sh) for Linux
and macOS. For Windows, use the latest `..._installer.exe` file from GitHub
Releases.

```shell
curl -L https://coder.com/install.sh | sh
```

You can run the install script with `--dry-run` to see the commands that will be used to install without executing them. Run the install script with `--help` for additional flags.

> See [install](https://coder.com/docs/install) for additional methods.

Once installed, you can start a production deployment with a single command:

```shell
# Automatically sets up an external access URL on *.try.coder.app
coder server

# Requires a PostgreSQL instance (version 13 or higher) and external access URL
coder server --postgres-url <url> --access-url <url>
```

Use `coder --help` to get a list of flags and environment variables. Use our [install guides](https://coder.com/docs/install) for a complete walkthrough.

## Documentation

Coder provides comprehensive documentation to help you get the most out of the platform. Browse our [complete documentation here](https://coder.com/docs) or jump directly to a specific section:

- [**Templates**](https://coder.com/docs/templates): Learn how to use Terraform to define your development environment infrastructure
- [**Workspaces**](https://coder.com/docs/workspaces): Discover how workspaces package IDEs, dependencies, and configuration for seamless development
- [**IDEs**](https://coder.com/docs/ides): Connect VS Code, JetBrains, and other popular editors to your remote workspaces
- [**Administration**](https://coder.com/docs/admin): Master deployment, configuration, and operational best practices
- [**Premium**](https://coder.com/pricing#compare-plans): Explore enterprise features designed for security, compliance, and scale

Need help? Join our [Discord community](https://discord.gg/coder) for guidance from the Coder team and community members.

## Support

Feel free to [open an issue](https://github.com/coder/coder/issues/new) if you have questions, run into bugs, or have a feature request.

[Join our Discord](https://discord.gg/coder) to provide feedback on in-progress features and chat with the community using Coder!

## Integrations

We are always working on new integrations. Please feel free to open an issue and ask for an integration. Contributions are welcome in any official or community repositories.

### Official

- [**VS Code Extension**](https://marketplace.visualstudio.com/items?itemName=coder.coder-remote): Open any Coder workspace in VS Code with a single click
- [**JetBrains Gateway Extension**](https://plugins.jetbrains.com/plugin/19620-coder): Open any Coder workspace in JetBrains Gateway with a single click
- [**Dev Container Builder**](https://github.com/coder/envbuilder): Build development environments using `devcontainer.json` on Docker, Kubernetes, and OpenShift
- [**Module Registry**](https://registry.coder.com): Extend development environments with common use-cases
- [**Kubernetes Log Stream**](https://github.com/coder/coder-logstream-kube): Stream Kubernetes Pod events to the Coder startup logs
- [**Self-Hosted VS Code Extension Marketplace**](https://github.com/coder/code-marketplace): A private extension marketplace that works in restricted or airgapped networks integrating with [code-server](https://github.com/coder/code-server).
- [**Setup Coder**](https://github.com/marketplace/actions/setup-coder): An action to setup coder CLI in GitHub workflows.

### Community

- [**Provision Coder with Terraform**](https://github.com/ElliotG/coder-oss-tf): Provision Coder on Google GKE, Azure AKS, AWS EKS, DigitalOcean DOKS, IBMCloud K8s, OVHCloud K8s, and Scaleway K8s Kapsule with Terraform
- [**Coder Template GitHub Action**](https://github.com/marketplace/actions/update-coder-template): A GitHub Action that updates Coder templates

## Contributing

We are always happy to see new contributors to Coder. If you are new to the Coder codebase, we have
[a guide on how to get started](https://coder.com/docs/CONTRIBUTING). We'd love to see your
contributions!

## Hiring

Apply [here](https://jobs.ashbyhq.com/coder?utm_source=github&utm_medium=readme&utm_campaign=unknown) if you're interested in joining our team.
