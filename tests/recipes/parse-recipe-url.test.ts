import { describe, expect, it } from "vitest";
import {
  isIngredientHeaderLine,
  parseIngredientLine,
  parseRecipeFromHtml,
} from "@/lib/recipes/parse-recipe-url";
import { INSTRUCTION_SECTION_PREFIX } from "@/lib/recipes/instruction-format";

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

describe("isIngredientHeaderLine", () => {
  it("detects colon headers", () => {
    expect(isIngredientHeaderLine("Till biffarna:")).toBe(true);
  });

  it("detects Till-prefixed headers without colon", () => {
    expect(isIngredientHeaderLine("Till tzatzikin")).toBe(true);
  });

  it("does not treat quantified lines as headers", () => {
    expect(isIngredientHeaderLine("500 g köttfärs")).toBe(false);
    expect(isIngredientHeaderLine("½ dl majsstärkelse")).toBe(false);
    expect(isIngredientHeaderLine("1½ dl vetemjöl")).toBe(false);
  });

  it("does not treat single-word ingredients as headers", () => {
    expect(isIngredientHeaderLine("salt")).toBe(false);
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

  it("expands Arla-style phased instructions with all steps", () => {
    const html = `
      <script type="application/ld+json">
      {
        "type": "Recipe",
        "name": "Gyros",
        "recipeIngredient": ["1 st bröd"],
        "recipeInstructions": [
          {
            "type": "HowToSection",
            "name": "Förbered",
            "itemListElement": [
              { "type": "HowToStep", "text": "Skär löken." },
              { "type": "HowToStep", "text": "Marinera köttet." }
            ]
          },
          {
            "type": "HowToSection",
            "name": "Blanda",
            "itemListElement": [
              { "type": "HowToStep", "text": "Blanda tzatziki." }
            ]
          },
          {
            "type": "HowToSection",
            "name": "Laga och servera",
            "itemListElement": [
              { "type": "HowToStep", "text": "Stek biffarna." },
              { "type": "HowToStep", "text": "Servera med bröd." }
            ]
          }
        ]
      }
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://www.arla.se/recept/gyros/");
    expect(result?.instructions).toEqual([
      `${INSTRUCTION_SECTION_PREFIX}Förbered`,
      "Skär löken.",
      "Marinera köttet.",
      `${INSTRUCTION_SECTION_PREFIX}Blanda`,
      "Blanda tzatziki.",
      `${INSTRUCTION_SECTION_PREFIX}Laga och servera`,
      "Stek biffarna.",
      "Servera med bröd.",
    ]);
  });

  it("unwraps ListItem-wrapped steps", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Test",
        "recipeIngredient": ["1 st salt"],
        "recipeInstructions": [
          {
            "@type": "ListItem",
            "position": 1,
            "item": { "@type": "HowToStep", "text": "Steg ett." }
          },
          {
            "@type": "ListItem",
            "position": 2,
            "item": { "@type": "HowToStep", "text": "Steg två." }
          }
        ]
      }
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://example.com");
    expect(result?.instructions).toEqual(["Steg ett.", "Steg två."]);
  });

  it("parses ingredient sections from header lines", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Gyros",
        "recipeIngredient": [
          "Till biffarna:",
          "500 g köttfärs",
          "Till tzatzikin:",
          "1 dl yoghurt"
        ],
        "recipeInstructions": [{ "@type": "HowToStep", "text": "Servera." }]
      }
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://example.com");
    expect(result?.ingredients).toEqual([
      expect.objectContaining({ name: "köttfärs", section: "Till biffarna" }),
      expect.objectContaining({ name: "yoghurt", section: "Till tzatzikin" }),
    ]);
  });

  it("parses Arla ingredientGroups from page HTML", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Orange chicken",
        "recipeIngredient": ["500 g kyckling", "½ dl majsstärkelse"],
        "recipeInstructions": []
      }
      </script>
      ingredientGroups":[{"title":null,"ingredients":[{"formattedName":"Kyckling","formattedAmount":"500 g"}]},{"title":"Apelsins&#xE5;s:","ingredients":[{"formattedName":"Vitl&#xF6;k","formattedAmount":"3"},{"formattedName":"Apelsins&#xE5;s","formattedAmount":""}]},{"title":"Till servering:","ingredients":[{"formattedName":"Ris","formattedAmount":"3 dl"}]}]
    `;
    const result = parseRecipeFromHtml(html, "https://www.arla.se/recept/x/");
    expect(result?.ingredients).toEqual([
      expect.objectContaining({ name: "Kyckling", section: undefined }),
      expect.objectContaining({ name: "Vitlök", section: "Apelsinsås" }),
      expect.objectContaining({ name: "Ris", section: "Till servering" }),
    ]);
    expect(result?.ingredients.some((i) => i.name === "Apelsinsås")).toBe(false);
  });

  it("parses grouped ingredient objects with name and recipeIngredient", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Test",
        "recipeIngredient": [
          {
            "name": "Biffar",
            "recipeIngredient": ["500 g köttfärs", "1 tsk salt"]
          },
          {
            "name": "Tzatziki",
            "recipeIngredient": ["1 dl yoghurt"]
          }
        ],
        "recipeInstructions": []
      }
      </script>
    `;
    const result = parseRecipeFromHtml(html, "https://example.com");
    expect(result?.ingredients).toEqual([
      expect.objectContaining({ name: "köttfärs", section: "Biffar" }),
      expect.objectContaining({ name: "salt", section: "Biffar" }),
      expect.objectContaining({ name: "yoghurt", section: "Tzatziki" }),
    ]);
  });
});
