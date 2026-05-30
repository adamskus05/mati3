import { describe, expect, it } from "vitest";
import {
  parseIngredientLine,
  parseRecipeFromHtml,
} from "@/lib/recipes/parse-recipe-url";

describe("parseIngredientLine", () => {
  it("parses quantity and unit", () => {
    expect(parseIngredientLine("2 dl mjölk")).toMatchObject({
      name: "mjölk",
      quantity: 2,
      unit: "dl",
    });
  });

  it("parses name only", () => {
    expect(parseIngredientLine("salt")).toMatchObject({ name: "salt" });
  });
});

describe("parseRecipeFromHtml", () => {
  it("extracts Recipe from JSON-LD", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Pannkakor",
        "recipeIngredient": ["2 dl mjölk", "2 ägg"],
        "recipeInstructions": [
          { "@type": "HowToStep", "text": "Blanda allt." },
          { "@type": "HowToStep", "text": "Stek." }
        ]
      }
      </script>
      </head></html>
    `;
    const result = parseRecipeFromHtml(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Pannkakor");
    expect(result?.ingredients).toHaveLength(2);
    expect(result?.instructions).toEqual(["Blanda allt.", "Stek."]);
  });

  it("finds Recipe in @graph", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@graph": [
          { "@type": "WebPage", "name": "Page" },
          {
            "@type": "Recipe",
            "name": "Soppa",
            "recipeIngredient": ["1 l vatten"],
            "recipeInstructions": "Koka."
          }
        ]
      }
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://example.com");
    expect(result?.title).toBe("Soppa");
    expect(result?.ingredients[0]?.name).toBe("vatten");
  });

  it("returns null when no recipe", () => {
    const html = "<html><body>Hej</body></html>";
    expect(parseRecipeFromHtml(html, "https://example.com")).toBeNull();
  });

  it("finds Recipe in top-level JSON-LD array (Arla-style type field)", () => {
    const html = `
      <script type="application/ld+json">
      [
        {"@type":"Organization","name":"Arla"},
        {
          "@context":"https://schema.org/",
          "type":"Recipe",
          "name":"Kycklinggryta",
          "recipeIngredient":["500 g kyckling","2 msk curry"],
          "recipeInstructions":[{
            "type":"HowToSection",
            "itemListElement":[
              {"type":"HowToStep","text":"Stek kycklingen."},
              {"type":"HowToStep","text":"Servera."}
            ]
          }]
        }
      ]
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://www.arla.se/recept/x/");
    expect(result?.title).toBe("Kycklinggryta");
    expect(result?.ingredients).toHaveLength(2);
    expect(result?.instructions).toEqual(["Stek kycklingen.", "Servera."]);
  });
});
