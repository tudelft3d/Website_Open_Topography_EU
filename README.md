# OpenEUTopography Website

This repository contains a static website showcasing European topography datasets.

## Setup

Install dependencies using `pip`:

```bash
pip install -r requirements.txt
```

For development and testing, install additional packages:

```bash
pip install -r requirements-dev.txt
```

## Usage

Start a local development server from the `SRC` directory:

```bash
make serve
```

Open <http://localhost:8000> in your browser.

## Testing

Run unit tests with:

```bash
make test
```

## Deployment

Site updates are published via GitHub Actions. On each push to `main`,
the workflow defined in `.github/workflows/gh-pages.yml` runs `make test`
and then deploys the contents of `SRC/` to the `gh-pages` branch.
