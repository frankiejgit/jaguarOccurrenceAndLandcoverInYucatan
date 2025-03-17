import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon
import matplotlib.pyplot as plt

#### 1. Load and preprocess data ####

# Jaguar occurrence data
df = pd.read_csv("data/occurrence.txt", sep="\t")

# Drop columns with no coordinates
df.dropna(subset=["decimalLatitude", "decimalLongitude"], inplace=True)

# Rename columns so GEE recognizes them easily (e.g. 'latitude' and 'longitude')
df.rename(columns={
    "decimalLatitude": "latitude",
    "decimalLongitude": "longitude"
}, inplace=True)

# Split the "date" column into separate columns
df["date"] = pd.to_datetime(df["date"], format="%m/%d/%y")

# Function to correct future years (>= 2026) in the "date" column
def correct_future_dates(date_value):
    if pd.notna(date_value):  # Check if date is valid
        if date_value.year >= 2026:
            corrected_year = date_value.year - 100  # Convert 20XX → 19XX
            return date_value.replace(year=corrected_year)
    return date_value  # Return unchanged date if valid

# Apply the correction to the "date" column
df["date"] = df["date"].apply(correct_future_dates)

# Extract year, month, day from the DateTime column
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.month
df["day"] = df["date"].dt.day

# Convert 'year' to numeric if it's not already
df["year"] = pd.to_numeric(df["year"], errors="coerce")

# Drop any rows where 'year' is NaN
df = df.dropna(subset=["year"])

# Select the columns to keep, for full dataset, look at "data/occurrence.txt" 
# or download original data from GBIF
cols_to_keep = [
    "latitude", "longitude", "date", "year", "month", "day",
    "type", "basisOfRecord", "gbifID", "occurrenceID"
]

df = df[cols_to_keep]

# Drop rows where the date couldn't be parsed
df = df.dropna(subset=["date"])

# Convert the date into ISO 8601 format
df["system:time_start"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S")

# Drop the old "date" column (if needed)
df = df.drop(columns=["date"])

#### 2. Create objects for GeoPandas ####

# Polygon for the Mesoamerican biological corridor (MBC)
mbc_coords = [
    (-91.17999732980365, 13.63943856854202),
    (-87.99396217355365, 12.890920733564085),
    (-86.28009498605365, 11.171791270208502),
    (-86.60968482980365, 10.394749848494728),
    (-84.91779029855365, 9.203908557876208),
    (-84.58820045480365, 8.726417117304832),
    (-82.17120826730365, 7.704314168195366),
    (-81.31427467355365, 6.701561688309798),
    (-79.64435279855365, 6.963360801589284),
    (-80.14972389230365, 8.074313176857796),
    (-79.24884498605365, 8.661256539681315),
    (-78.67755592355365, 8.509171427457526),
    (-78.56769264230365, 7.747860548091974),
    (-77.68878639230365, 6.832479161099103),
    (-77.00763404855365, 8.400502150062856),
    (-77.16144264230365, 8.900122834773223),
    (-79.09503639230365, 9.962213910373398),
    (-80.06183326730365, 9.594105879246467),
    (-81.29230201730365, 9.095443159836616),
    (-82.02264812311589, 9.404240152262705),
    (-82.81366374811589, 9.945741454623418),
    (-83.47284343561589, 10.875001838805666),
    (-82.85760906061589, 14.794687086681176),
    (-83.12128093561589, 15.26155118610412),
    (-84.79120281061589, 16.128830744255552),
    (-88.41669109186589, 15.959896599637476),
    (-86.21942546686589, 21.615194199233745),
    (-87.99921062311589, 21.839721773016596),
    (-90.24042156061589, 21.533461083001235),
    (-91.62469890436589, 18.91527033275978),
    (-94.28339031061589, 18.519870571992328),
    (-93.93182781061589, 17.43308907587558),
    (-94.43719890436589, 15.85424027498519),
    (-91.17999732980365, 13.63943856854202)
]

# Create MBC polygon
mbc_polygon = Polygon(mbc_coords)

# Create a geometry column using the coordinates
geometry = [Point(xy) for xy in zip(df["longitude"], df["latitude"])]

gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")

#### 3. Filter to only get the records inside MBC ####
mbc_gdf = gdf[gdf.geometry.within(mbc_polygon)]

#### 4 . Visualize data ####

# Plot the records on a map
url = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip"
world = gpd.read_file(url)
ax = world.plot()        

# Plot the MBC Polygon
gpd.GeoSeries(mbc_polygon).plot(ax=ax, edgecolor="black", facecolor="none", linewidth=2, label="MBC Boundary")

# Plot the original points
gdf.plot(ax=ax, color="gray", marker="o", markersize=10, alpha=0.5, label="Original Points")

# Plot the filtered points (inside MBC)
mbc_gdf.plot(ax=ax, color="red", marker="o", markersize=10, label="Points in MBC")

# Add labels
plt.xlabel("Longitude")
plt.ylabel("Latitude")
plt.title("Occurrences Inside the Mesoamerican Biological Corridor")
plt.legend()
plt.grid(True)
plt.show()

# View the distribution of sightings within MBC by year
year_counts = mbc_gdf["year"].value_counts().sort_index()

# Create a histogram for row count by year
plt.bar(year_counts.index, year_counts.values)
plt.xlabel("Year")
plt.ylabel("Sightings (count)")
plt.title("Jaguar Sightings by Year")
plt.show()

# Export to CSV
mbc_gdf.to_csv("data/mbc_jaguar_occurence.csv", index=False)
